# import http stuffs
from django.shortcuts import render, get_object_or_404
from django.http import HttpResponse, HttpResponseBadRequest, Http404
import json
# import our models and helpers
from services.models import Organism, Cvterm, Cv, Feature, Featureloc, Phylonode,\
FeatureRelationship, GeneOrder, Featureprop, GeneFamilyAssignment
# search stuffs
from django.db.models import Q, Func, F
# context view
import operator
# so anyone can use the services
from django.views.decorators.csrf import csrf_exempt
# time stuff for caching
from django.utils.http import http_date
import time


# decorator for invalidating the cache every hour
def ensure_nocache(view):
    def wrapper(request, *args, **kwargs):
        response = view(request, *args, **kwargs)
        response['Cache-Control'] = 'max-age=3600, must-revalidate'
        response['Expires'] = http_date(time.time() + 3600)
        return response
    return wrapper


#########################################################
# these are services for the stand alone context viewer #
#########################################################

######
# v1 #
######

# returns contexts centered at genes in the list provided
@csrf_exempt
@ensure_nocache
def v1_micro_synteny_basic(request):
    # parse the POST data (Angular puts it in the request body)
    POST = json.loads(request.body)

    # make sure the request type is POST and that it contains a list of genes
    if request.method == 'POST' and 'genes' in POST and 'neighbors' in POST:
        # prepare a generic response
        generic = HttpResponse(
            json.dumps('{"families":[], "groups":[]}'),
            content_type='application/json; charset=utf8'
        )

        # how many genes will be displayed?
        num = POST['neighbors']
        try:
            num = int(num)
            if num <= 0:
                raise ValueError("neighbors can't be negative")
        except:
            return HttpResponseBadRequest
        # get the focus genes
        focus_genes = Feature.objects.only('organism_id', 'name')\
        .filter(name__in=POST['genes'])
        if not focus_genes:
            return generic

        #######################
        # begin fetching data #
        #######################

        # what we'll use to construct the json
        groups = []
        families = {}

        # the gene_family cvterm
        y = 0
        family_term = list(Cvterm.objects.filter(name='gene family')[:1])[0]
        focus_family_id = None

        # get the focus gene locations
        focus_locs = Featureloc.objects.only(
            'feature_id',
            'srcfeature_id',
            'fmin',
            'fmax',
            'strand'
        ).filter(feature__in=focus_genes)
        focus_loc_map = dict((o.feature_id, o) for o in focus_locs)
        if not focus_loc_map:
            return generic

        # get the source feature names of the feature locs
        srcfeatures = Feature.objects.only('name').filter(
            pk__in=focus_locs.values_list('srcfeature_id', flat=True)
        )
        srcfeature_map = dict((o.pk, o) for o in srcfeatures)
        if not srcfeature_map:
            return generic

        # get the organisms for all the focus gene
        organisms = Organism.objects.only('genus', 'species').filter(
            pk__in=focus_genes.values_list('organism_id', flat=True)
        )
        organism_map = dict((o.pk, o) for o in organisms)
        if not organism_map:
            return generic

        # get the focus genes family ids
        family_ids = GeneFamilyAssignment.objects.only(
            'gene_id', 'family_label'
        ).filter(gene_id__in=focus_genes)
        family_map = dict((o.gene_id, o.family_label) for o in family_ids)
        if not family_map:
            return generic

        # get the orders for the focus genes
        orders = list(GeneOrder.objects.filter(gene__in=focus_genes))
        order_map = dict((o.gene_id, o) for o in orders)
        if not orders:
            return generic

        # get the orders for all the genes surrounding the focus genes
        gene_queries = dict((o.pk,
            Q(chromosome_id=o.chromosome_id,
              number__lte=o.number+num,
              number__gte=o.number-num)
            ) for o in orders)
        gene_pool = list(GeneOrder.objects.filter(
            reduce(operator.or_, gene_queries.values())
        ))
        gene_pool_ids = map(lambda g: g.gene_id, gene_pool)
        group_by_chromosome = {}
        for g in gene_pool:
            if g.chromosome_id not in group_by_chromosome:
                group_by_chromosome[g.chromosome_id] = [g]
            else:
                group_by_chromosome[g.chromosome_id].append(g)

        def getNumber(g):
            return g.number

        track_gene_map = {}
        for o in orders:
            if o.chromosome_id in group_by_chromosome:
                track_gene_map[o.pk] = []
                for g in group_by_chromosome[o.chromosome_id]:
                    if g.number <= o.number+num and g.number >= o.number-num:
                        track_gene_map[o.pk].append(g)
                track_gene_map[o.pk] = sorted(
                    track_gene_map[o.pk],
                    key=getNumber
                )

        # get the feature names for all the genes surrounding the focus genes
        feature_pool = Feature.objects.only('name')\
        .filter(pk__in=gene_pool_ids)
        feature_name_map = dict((o.pk, o.name) for o in feature_pool)

        # get feature locations for all the genes surrounding the focus genes
        loc_queries = dict((o.pk,
            Q(chromosome=o.chromosome_id,
              number__lte=o.number+num,
              number__gte=o.number-num)
            ) for o in orders)
        loc_pool = Featureloc.objects.only(
            'feature_id',
            'fmin',
            'fmax',
            'strand'
        ).filter(feature__in=gene_pool_ids)
        gene_loc_map = dict((o.feature_id, o) for o in loc_pool)
        track_loc_map = {}
        for o in orders:
            track_loc_map[o.pk] = []
            for g in track_gene_map[o.pk]:
                track_loc_map[o.pk].append(gene_loc_map[g.gene_id])
            track_loc_map[o.pk] = sorted(
                track_loc_map[o.pk],
                key=lambda loc: loc.fmin
            )

        # get the families for all the genes surrounding the focus genes
        gene_families = GeneFamilyAssignment.objects.only(
            'gene_id',
            'family_label'
        ).filter(gene_id__in=gene_pool_ids)
        gene_family_map = dict(
            (o.gene_id, o.family_label) for o in gene_families
        )

        #######################
        # begin generate json #
        #######################

        for gene in focus_genes:
            if gene.pk not in focus_loc_map:
                continue
            focus_loc = focus_loc_map[gene.pk]
            srcfeature = srcfeature_map[focus_loc.srcfeature_id]
            organism = organism_map[gene.organism_id]
            family_id = family_map[gene.pk]
            if len(family_id) > 0:
                focus_family_id = family_id
                if family_id not in families:
                    families[family_id] = ('{"name":"' + family_id +
                        '", "id":"' + family_id + '"}')
            group = ('{"chromosome_name":"' + srcfeature.name +
                '", "chromosome_id":' + str(srcfeature.feature_id) +
                ', "genus":"' + organism.genus +
                '", "species":"' + organism.species +
                '", "species_id":' + str(gene.organism_id)+', "genes":[')
            order = order_map[gene.pk]
            track_genes = track_gene_map[order.pk]
            track_locs = track_loc_map[order.pk]

            # add gene entries for the track_locs
            genes = []
            for l in track_locs:
                family_id = '' if l.feature_id not in gene_family_map\
                               else gene_family_map[l.feature_id]
                if family_id != '':
                    if family_id not in families:
                            families[family_id] = ('{"name":"' + family_id +
                                '", "id":"' + family_id + '"}')
                genes.append('{"name":"' + feature_name_map[l.feature_id] +
                             '", "id":' + str(l.feature_id) + ',' +
                             '"fmin":' + str(l.fmin) + ',' +
                             '"fmax":' + str(l.fmax) + ',' +
                             '"strand":' + str(l.strand) + ',' +
                             '"family":"' + family_id + '"}')
            group += ','.join(genes) + ']}'
            groups.append(group)

        # write the contents of the file
        view_json = ('{"families":[' + ','.join(families.values()) + '], "groups":[' +
            ','.join(groups) + ']}')

        return HttpResponse(
            json.dumps(view_json),
            content_type='application/json; charset=utf8'
        )
    return HttpResponseBadRequest


# resolves a focus gene name to a query track
@csrf_exempt
@ensure_nocache
def v1_gene_to_query_track(request):
    # parse the POST data (Angular puts it in the request body)
    POST = json.loads(request.body)

    # make sure the request type is POST and that it contains a focus gene name
    if request.method == 'POST' and 'gene' in POST and 'neighbors' in POST:
        # get the focus gene of the query track
        focus = get_object_or_404(Feature, name=POST['gene'])
        focus_id = focus.pk
        focus_order = list(GeneOrder.objects.filter(gene=focus))
        if len(focus_order) == 0:
            raise Http404
        focus_order = focus_order[0]
        # how many neighbors should there be?
        num = POST['neighbors']
        try:
            num = int(num)
            if num <= 0:
                raise ValueError("neighbors can't be negative")
        except:
            return HttpResponseBadRequest
        # get the gene family type
        gene_family_type = list(
            Cvterm.objects.only('pk').filter(name='gene family')
        )
        if len(gene_family_type) == 0:
            raise Http404
        gene_family_type = gene_family_type[0]

        #################################
        # begin - construct query track #
        #################################

        # get the neighbors of focus via their ordering
        neighbor_ids = list(GeneOrder.objects.filter(
            chromosome=focus_order.chromosome_id,
            number__gte=focus_order.number-num,
            number__lte=focus_order.number+num
        ).order_by('number').values_list('gene_id', flat=True))

        # actually get the gene families
        neighbor_families = list(GeneFamilyAssignment.objects.only(
            'gene_id',
            'family_label'
        ).filter(gene_id__in=neighbor_ids))
        neighbor_family_map = dict(
            (o.gene_id, o.family_label) for o in neighbor_families
        )
        family_ids = []
        query_families = {}
        for n in neighbor_family_map.values():
            if n not in family_ids:
                family_ids.append(n)
                query_families[n] = 1

        # make the query track
        # get the gene names
        neighbor_features = list(Feature.objects.only('name')\
            .filter(pk__in=neighbor_ids))
        neighbor_name_map = dict((o.pk, o.name) for o in neighbor_features)
        # get the gene flocs
        neighbor_flocs = list(Featureloc.objects.only(
            'feature_id',
            'fmin',
            'fmax',
            'strand'
        ).filter(feature__in=neighbor_ids))
        neighbor_floc_map = dict((o.feature_id, o) for o in neighbor_flocs)
        # get the track chromosome
        chromosome = list(Feature.objects.only('name', 'organism_id')\
            .filter(pk=neighbor_floc_map[int(focus.pk)].srcfeature_id))
        chromosome = chromosome[0]
        # get the track organism
        organism = list(Organism.objects.only('genus', 'species')\
            .filter(pk=chromosome.organism_id))
        organism = organism[0]
        # generate the json for the query genes
        genes = []
        query_align = []
        for i in range(len(neighbor_ids)):
            g = neighbor_ids[i]
            family = str(neighbor_family_map[g] ) if g in neighbor_family_map else ''
            floc = neighbor_floc_map[g]
            genes.append('{"name":"' + neighbor_name_map[g] + '", "id":' +
                str(g) + ', "family":"' + family + '", "fmin":' +
                str(floc.fmin) + ', "fmax":' + str(floc.fmax) + ', "strand":' +
                str(floc.strand) + ', "x":' + str(i) + ', "y":0}')
            query_align.append((g, family))
        query_group = ('{"genus":"' + organism.genus + '", "species":"' +
            organism.species + '", "species_id":' + str(organism.pk) +
            ', "chromosome_name":"' + chromosome.name + '", "chromosome_id":' +
            str(chromosome.pk) + ', "genes":[' + ','.join(genes) + ']}')

        return HttpResponse(
            json.dumps(query_group),
            content_type='application/json; charset=utf8'
        )
    return HttpResponseBadRequest


# returns similar contexts to the families provided
@csrf_exempt
@ensure_nocache
def v1_micro_synteny_search(request):
    # parse the POST data (Angular puts it in the request body)
    POST = json.loads(request.body)

    # make sure the request type is POST and that it contains a query (families)
    if request.method == 'POST' and 'query' in POST and 'matched' in POST and 'intermediate' in POST:

        ###############################
        # begin - function parameters #
        ###############################

        # how many matched_families should there be?
        num_matched_families = POST['matched']
        try:
            num_matched_families = int(num_matched_families)
            if num_matched_families <= 0:
                raise ValueError("matched can't be negative")
        except:
            return HttpResponseBadRequest
        # the number of non query family genes tolerated between each pair of
        # family genes
        non_family = POST['intermediate']
        try:
            non_family = int(non_family)
            if non_family <= 0:
                raise ValueError("intermediate can't be negative")
        except:
            return HttpResponseBadRequest
        # the number of non query family genes tolerated between each pair of
        # get the gene family type
        gene_family_type = list(
            Cvterm.objects.only('pk').filter(name='gene family')
        )
        if len(gene_family_type) == 0:
            raise Http404
        gene_family_type = gene_family_type[0]

        ##################
        # begin - search #
        ##################

        # find all genes with the same families (excluding the query genes)
        # huge loss of power here - should use some kind of indexed lookup instead
        # of the value field
        family_ids = POST['query']
        related_genes = list(GeneFamilyAssignment.objects.only(
            'gene_id',
            'family_label'
        ).filter(family_label__in=family_ids))
        gene_family_map = dict((o.gene_id, o.family_label) for o in related_genes)

        # get the orders (and chromosomes) of the genes
        related_orders = list(GeneOrder.objects.only(
            'gene_id',
            'number',
            'chromosome_id'
        ).filter(gene__in=gene_family_map.keys()))
        gene_order_map = dict((o.gene_id, o.number) for o in related_orders)
        # group the genes by their chromosomes
        chromosome_genes_map = {}
        for o in related_orders:
            if o.chromosome_id in chromosome_genes_map:
                chromosome_genes_map[o.chromosome_id].append(o.gene_id)
            else:
                chromosome_genes_map[o.chromosome_id] = [o.gene_id]

        # fetch all the chromosome names (organism_id and pk are implicit)
        chromosomes = Feature.objects.only('organism_id', 'name')\
            .filter(pk__in=chromosome_genes_map.keys())
        id_chromosome_map = dict((o.pk, o) for o in chromosomes)

        # fetch the chromosome organisms
        organism_ids = chromosomes.values_list('organism_id', flat=True)
        organisms = list(Organism.objects.only('genus', 'species')\
            .filter(pk__in=organism_ids))
        id_organism_map = dict(
            (o.pk, o) for o in organisms
        )

        # construct tracks for each chromosome
        tracks = {}
        gene_queries = []
        for chromosome_id, genes in chromosome_genes_map.iteritems():
            if len(genes) < 2:
                continue
            # put the genes in order
            genes.sort(key=lambda g: gene_order_map[g])
            # find all disjoint subsets of the genes where all sequential genes in
            # the set are separated by no more than non_family non-query-family
            # genes
            block = [0]
            matched_families = set([gene_family_map[genes[0]]])
            # traverse the genes in the order they appear on the chromosome
            for i in range(1, len(genes)):
                g = genes[i]
                # add the gene to the current block if it meets the non query family
                # criteria
                gap_size = gene_order_map[g]-gene_order_map[genes[block[-1]]]-1
                if gap_size <= non_family:
                    matched_families.add(gene_family_map[g])
                    block.append(i)
                # otherwise, generate a track from the block and start a new block
                if gap_size > non_family or i == len(genes)-1:
                    # generate a track from the block
                    if len(matched_families) >= num_matched_families:
                        # get all the gene ids
                        tracks[
                            (chromosome_id, gene_order_map[genes[block[0]]],
                            gene_order_map[genes[block[-1]]])
                        ] = []
                        gene_queries.append(
                            Q(chromosome=chromosome_id,
                              number__gte=gene_order_map[genes[block[0]]],
                              number__lte=gene_order_map[genes[block[-1]]])
                        )
                    # start the next block
                    block = [i]
                    matched_families = set([gene_family_map[g]])

        # are there any queries to operate on?
        if len(gene_queries) != 0:
            # get the track genes
            gene_pool = list(GeneOrder.objects\
                .filter(reduce(operator.or_, gene_queries)))
            gene_ids = map(lambda x: x.gene_id, gene_pool)

            # get the track gene families
            track_gene_families = list(GeneFamilyAssignment.objects.only(
                'gene_id',
                'family_label'
            ).filter(gene_id__in=gene_ids))
            track_family_map = dict(
                (o.gene_id, o.family_label) for o in track_gene_families
            )

            # make sure all families are present in the json
            for f in track_family_map.values():
                if f not in family_ids:
                    family_ids.append(f)

            # get all the gene names
            gene_names = list(Feature.objects.only('name').filter(pk__in=gene_ids))
            gene_name_map = dict((o.pk, o.name) for o in gene_names)

            # get all the gene featurelocs
            gene_locs = list(Featureloc.objects.only(
                'feature_id',
                'fmin',
                'fmax',
                'strand'
            ).filter(feature__in=gene_ids))
            gene_loc_map = dict((o.feature_id, o) for o in gene_locs)

            # construct a list of genes for each track
            for key in tracks.keys():
                chromosome_id, lower_bound, upper_bound = key
                for o in gene_pool:
                    if o.chromosome_id == chromosome_id and o.number >= lower_bound\
                    and o.number <= upper_bound:
                        tracks[key].append(o)
                tracks[key] = map(
                    lambda x: x.gene_id,
                    sorted(tracks[key], key=lambda o: o.number)
                )

        # jsonify the tracks... that's right, jsonify
        groups = []
        y = 1
        for key in tracks.keys():
            chromosome_id, lower_order, upper_order = key
            gene_json = []
            for g in tracks[key]:
                family = track_family_map[g] if g in track_family_map else ''
                gene_json.append('{"name":"' + gene_name_map[g] + '", "id":' +
                    str(g) + ', "family":"' +family + '", "fmin":' +
                    str(gene_loc_map[g].fmin) + ', "fmax":' +
                    str(gene_loc_map[g].fmax) + ', "strand":' +
                    str(gene_loc_map[g].strand)+'}')
            chromosome = id_chromosome_map[chromosome_id]
            organism = id_organism_map[chromosome.organism_id]
            group = ('{"genus":"' + organism.genus +
                '", "species":"' + organism.species +
                '", "species_id":' +
                str(chromosome.organism_id) +
                ', "chromosome_name":"' + chromosome.name +
                '", "chromosome_id":' + str(chromosome_id) + ', "genes":[' +
                ','.join(gene_json)+']}')
            groups.append(group)
            # prepare for the next track
            y += 1

        ################
        # begin - json #
        ################

        # make the family json
        family_json = []
        for f in family_ids :
            family_json.append('{"name":"'+f+'", "id":"'+f+'"}')
        view_json = '{"families":['+','.join(family_json)+'], "groups":['

        # make the final json
        view_json += ','.join(groups)+']}'

        return HttpResponse(
            json.dumps(view_json),
            content_type='application/json; charset=utf8'
        )
    return HttpResponseBadRequest


# returns all the GENES for the given chromosome that have the same family as
# the query
@csrf_exempt
@ensure_nocache
def v1_global_plot(request):
    # parse the POST data (Angular puts it in the request body)
    POST = json.loads(request.body)

    # make sure the request type is POST and that it contains a query (families)
    if request.method == 'POST' and 'query' in POST and 'chromosome' in POST:
        # get the gene family type
        gene_family_type = list(Cvterm.objects.only('pk')\
            .filter(name='gene family'))
        if len(gene_family_type) == 0:
            raise Http404
        gene_family_type = gene_family_type[0]

        # find all genes with the same families
        chromosome_gene_orders = GeneOrder.objects.filter(
            chromosome=POST["chromosome"]
        )
        chromosome_gene_ids = chromosome_gene_orders.values_list(
            "gene", flat=True
        )
        related_genes = Featureprop.objects.only('feature').filter(
            type=gene_family_type,
            value__in=POST['query'],
            feature__in=chromosome_gene_ids
        )
        gene_family_map = dict((o.feature_id, o.value) for o in related_genes)
        related_gene_ids = gene_family_map.keys()

        # get all the gene names
        gene_names = Feature.objects.only('name').filter(
            pk__in=related_gene_ids
        )
        gene_name_map = dict((o.pk, o.name) for o in gene_names)

        # get all the gene featurelocs
        gene_locs = Featureloc.objects.only('fmin', 'fmax', 'strand')\
            .filter(feature__in=related_gene_ids)
        gene_loc_map = dict((o.feature_id, o) for o in gene_locs)

        # make the json
        gene_json = []
        for g in related_gene_ids:
            loc = gene_loc_map[g]
            gene_json.append({
                "name": gene_name_map[g],
                "id": g,
                "family": str(gene_family_map[g]),
                "fmin": loc.fmin,
                "fmax": loc.fmax,
                "strand": loc.strand,
                "x": 0,
                "y": 0
            })
        # return the plot data as encoded as json
        return HttpResponse(
            json.dumps(gene_json),
            content_type='application/json; charset=utf8'
        )
    return HttpResponseBadRequest


# returns chromosome scale synteny blocks for the chromosome of the given gene
@csrf_exempt
@ensure_nocache
def v1_macro_synteny(request):
    # parse the POST data (Angular puts it in the request body)
    POST = json.loads(request.body)
    # make sure the request type is POST and that it contains a query (families)
    if request.method == 'POST' and 'chromosome' in POST:
        # get the query chromosome
        chromosome = get_object_or_404(Feature, pk=POST['chromosome'])
        # get the syntenic region cvterm
        synteny_type = list(Cvterm.objects.only('pk')\
            .filter(name='syntenic_region'))
        if len(synteny_type) == 0:
            raise Http404
        synteny_type = synteny_type[0]
        # get all the related featurelocs
        blocks = list(Featureloc.objects\
            .only('feature', 'fmin', 'fmax', 'strand')\
            .filter(srcfeature=chromosome, feature__type=synteny_type, rank=0))
        # get the chromosome each region belongs to
        region_ids = map(lambda b: b.feature_id, blocks)
        regions = None
        if 'results' in POST:
            regions = list(Featureloc.objects\
                .only('feature', 'srcfeature')\
                .filter(feature__in=region_ids, srcfeature__in=POST['results'], rank=1))
        else:
            regions = list(Featureloc.objects\
                .only('feature', 'srcfeature')\
                .filter(feature__in=region_ids, rank=1))
        region_to_chromosome = dict(
            (r.feature_id, r.srcfeature_id) for r in regions
        )
        # actually get the chromosomes
        chromosomes = list(Feature.objects.only('name', 'organism')\
            .filter(pk__in=region_to_chromosome.values()))
        chromosome_map = dict((c.pk, c) for c in chromosomes)
        # get the chromosomes' organisms
        organisms = Organism.objects.only('genus', 'species').filter(
            pk__in=map(lambda c: c.organism_id, chromosomes)
        )
        organism_map = dict((o.pk, o) for o in organisms)
        # group the blocks by feature
        feature_locs = {}
        for l in blocks:
            if l.feature_id in region_to_chromosome:
                orientation = '-' if l.strand == -1 else '+'
                c = chromosome_map[region_to_chromosome[l.feature_id]]
                name = c.name
                o = organism_map[c.organism_id]
                species = o.species
                genus = o.genus
                feature_locs.setdefault((name, species, genus), []).append(
                    {'start':l.fmin, 'stop':l.fmax, 'orientation':orientation}
                )
        # generate the json
        tracks = []
        for (name, species, genus), blocks in feature_locs.iteritems():
            tracks.append({
                'chromosome': name,
                'species': species,
                'genus': genus,
                'blocks': blocks
            })
        synteny_json = {'chromosome': chromosome.name,
                        'length': chromosome.seqlen,
                        'tracks': tracks}
        # return the synteny data as encoded as json
        return HttpResponse(
            json.dumps(synteny_json),
            content_type='application/json; charset=utf8'
        )
    return HttpResponseBadRequest


# returns the gene on the given chromosome that is closest to the given position
@csrf_exempt
@ensure_nocache
def v1_nearest_gene(request):
    # parse the POST data (Angular puts it in the request body)
    POST = json.loads(request.body)
    # make sure the request type is POST and that it contains the correct data
    if request.method == 'POST' and 'chromosome' in POST and 'position' in POST:
        # parse the position
        pos = POST['position']
        try:
            pos = int(pos)
            if pos < 0:
                raise ValueError("matched can't be negative")
        except:
            return HttpResponseBadRequest
        # get the gene type
        sequence_cv = Cv.objects.only('pk').filter(name='sequence')
        gene_type = list(
            Cvterm.objects.only('pk').filter(name='gene', cv_id=sequence_cv)
        )
        if len(gene_type) == 0:
            raise Http404
        gene_type = gene_type[0]
        # find the gene closest to the given position
        loc = Featureloc.objects.only(
            'feature_id',
            'srcfeature_id',
            'fmin',
            'fmax',
            'strand'
        ).filter(
            feature__type=gene_type, srcfeature=POST['chromosome']
        ).annotate(dist=Func(
            ((F('fmin') + F('fmax')) / 2) - pos, function='ABS'
        )).order_by('dist').first()
        gene = get_object_or_404(Feature, pk=loc.feature.pk)
        family = None
        try:
            family = GeneFamilyAssignment.objects.get(gene_id=gene.pk)
        except GeneFamilyAssignment.DoesNotExist:
            family = GeneFamilyAssignment(family_label='')
        # jsonify the gene and return it
        data = {
            "name": gene.name,
            "id": gene.pk,
            "family": family.family_label,
            "fmin": loc.fmin,
            "fmax": loc.fmax,
            "strand": loc.strand
        }
        # return the synteny data as encoded as json
        return HttpResponse(
            json.dumps(data),
            content_type='application/json; charset=utf8'
        )
    return HttpResponseBadRequest

###############
# depreciated #
###############

# returns contexts centered at genes in the list provided
@csrf_exempt
@ensure_nocache
def micro_synteny_basic(request):
    # parse the POST data (Angular puts it in the request body)
    POST = json.loads(request.body)

    # make sure the request type is POST and that it contains a list of genes
    if request.method == 'POST' and 'genes' in POST and 'numNeighbors' in POST:
        POST['neighbors'] = POST['numNeighbors']
        del POST['numNeighbors']
        request._body = json.dumps(POST)
        return v1_micro_synteny_basic(request)
    return HttpResponseBadRequest


# resolves a focus gene name to a query track
@csrf_exempt
@ensure_nocache
def gene_to_query(request):
    # parse the POST data (Angular puts it in the request body)
    POST = json.loads(request.body)

    # make sure the request type is POST and that it contains a focus gene name
    if request.method == 'POST' and 'gene' in POST and 'numNeighbors' in POST:
        POST['neighbors'] = POST['numNeighbors']
        del POST['numNeighbors']
        request._body = json.dumps(POST)
        return v1_gene_to_query_track(request)
    return HttpResponseBadRequest


# returns similar contexts to the families provided
@csrf_exempt
@ensure_nocache
def micro_synteny_search(request):
    # parse the POST data (Angular puts it in the request body)
    POST = json.loads(request.body)

    # make sure the request type is POST and that it contains a query (families)
    if request.method == 'POST' and 'query' in POST and 'numNeighbors' in POST and 'numMatchedFamilies' in POST:
        POST['matched'] = POST['numMatchedFamilies']
        del POST['numMatchedFamilies']
        POST['intermediate'] = POST['numNonFamily']
        del POST['numNonFamily']
        request._body = json.dumps(POST)
        return v1_micro_synteny_search(request)
    return HttpResponseBadRequest


# returns all the GENES for the given chromosome that have the same family as
# the query
@csrf_exempt
@ensure_nocache
def global_plots(request):
    # parse the POST data (Angular puts it in the request body)
    POST = json.loads(request.body)

    # make sure the request type is POST and that it contains a query (families)
    if request.method == 'POST' and 'query' in POST and 'chromosomeID' in POST:
        POST['chromosome'] = POST['chromosomeID']
        del POST['chromosomeID']
        request._body = json.dumps(POST)
        return v1_global_plot(request)
    return HttpResponseBadRequest
