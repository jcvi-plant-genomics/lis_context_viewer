'use strict'

/** The Genomic Context Viewer namespace. */
var GCV = GCV || {};

/** The micro-synteny viewer. */
GCV.Viewer = class {

//  // data preprocessing
//  var partitions = {},
//      groups = {},
//      left_breaks = {},
//      right_breaks = {},
//      interTracks = {},
//      omit = {},
//      uid = 0;
//  for (var i = 0; i < data.groups.length; i++) {
//    // order the track genes to ease processing
//    data.groups[i].genes.sort(function (a, b) {
//      return a.x-b.x;
//    });
//    // prepare for inter track lines and to merge partitions
//    if ((opt.merge !== undefined && opt.merge == true) ||
//        (opt.interTrack !== undefined && opt.interTrack == true)) {
//      var id = data.groups[i].id;
//      if (partitions[id] === undefined) {
//        partitions[id] = [];
//        groups[id] = clone(data.groups[i]);
//        groups[id].genes = [];
//        left_breaks[id] = [];
//        right_breaks[id] = [];
//        interTracks[id] = {};
//        omit[id] = [];
//      }
//      // give each gene in the partition a unique id
//      for (var j = 0; j < data.groups[i].genes.length; j++) {
//        data.groups[i].genes[j].uid = uid++;
//        data.groups[i].genes[j].group_id = id;
//      }
//      left_breaks[id].push(data.groups[i].genes[0].uid);
//      right_breaks[id].push(data.groups[i].genes[data.groups[i].genes.length-1].uid);
//      partitions[id].push(data.groups[i].genes);
//    }
//  }
//
//  // helper functions for inter-track line drawing
//  function locMin(genes) {
//    return d3.min(genes, function (g) {
//      return +g.fmin;
//    });
//  }
//  function locMax(genes) {
//    return d3.max(genes, function (g) {
//      return +g.fmax;
//    });
//  }
//  function inversionPrep(id, inversion, sup, sup_inversion) {
//    // mark the sides of the inversion break in the super track
//    // mark where inter track lines will be drawn
//    var left = sup_inversion[0];
//    if (left > 0) {
//      right_breaks[id].push(sup[left-1].uid);
//      interTracks[id][sup[left-1].uid] = inversion[inversion.length-1];
//    }
//    var right = sup_inversion[sup_inversion.length-1];
//    if (right < sup.length-1) {
//      left_breaks[id].push(sup[right+1].uid);
//      interTracks[id][sup[right+1].uid] = inversion[0];
//    }
//    // a list of all genes that should be omitted when drawing the track
//    for (var k = left; k <= right; k++) {
//      omit[id].push(sup[k].uid);
//    }
//  }
//
//  // merge tracks and determine where to draw inter-track lines
//  if ((opt.merge !== undefined && opt.merge == true) ||
//      (opt.interTrack !== undefined && opt.interTrack == true)) {
//    if (opt.merge !== undefined && opt.merge == true) {
//      data.groups = [];
//    }
//    var group_y = 0;
//    for (var id in partitions) {
//      // determine where to draw inter-track lines
//      if (opt.interTrack && opt.interTrack == true) {
//        // iterate pairs of tracks to see if one is an inversion of the other
//        for (var i = 0; i < partitions[id].length-1; i++) {
//          for (var j = i+1; j < partitions[id].length; j++) {
//            // the tracks must overlap
//            var iMin = locMin(partitions[id][i]),
//                iMax = locMax(partitions[id][i]),
//                jMin = locMin(partitions[id][j]),
//                jMax = locMax(partitions[id][j]);
//            if ((iMin <= jMin && jMin <= iMax) ||
//                (iMin <= jMax && jMin <= iMax) ||
//                (jMin <= iMin && iMin <= jMax) ||
//                (jMin <= iMax && iMin <= jMax)) {
//              // intersect the tracks to see if they overlap
//              var iSec = [],
//                  jSec = [];
//              for (var k = 0; k < partitions[id][i].length; k++) {
//                for (var l = 0; l < partitions[id][j].length; l++) {
//                  if (partitions[id][i][k].id == partitions[id][j][l].id) {
//                    iSec.push(k);
//                    jSec.push(l);
//                  }
//                }
//              }
//              // note where inter-track lines should be drawn    
//              if (iSec.length > 1) {
//                iSec.sort(function(a, b) { return a-b; }); 
//                jSec.sort(function(a, b) { return a-b; });
//                // assume the shorter of the tracks is the inversion    
//                if (partitions[id][j].length > partitions[id][i].length) {
//                  inversionPrep(id, partitions[id][i], partitions[id][j], jSec);
//                } else if (partitions[id][i].length > partitions[id][j].length) {
//                  inversionPrep(id, partitions[id][j], partitions[id][i], iSec);
//                }    
//              }
//            }
//          }
//        }
//      }
//      // merge partitions from same chromosome with the interval scheduling
//      // greedy algorithm
//      if (opt.merge && opt.merge == true) {
//        var partition_groups = [];
//        // sort the partition groups by "finish time"
//        partitions[id].sort(function (a, b) {
//          return a[a.length-1].x-b[b.length-1].x;
//        });
//        // generate the merged tracks
//        while (partitions[id].length > 0) {
//          var track_genes = [];
//          var remove = [];
//          for (var i = 0; i < partitions[id].length; i++) {
//            // make sure the genes are ordered by x coordinate
//            partitions[id].sort(function (a, b) {
//              return a.x-b.x;
//            });
//            // greedy ordering
//            var partition = partitions[id][i];
//            if (track_genes.length == 0 ||
//                partition[0].x > track_genes[track_genes.length-1].x) {
//              track_genes = track_genes.concat(partition);
//              remove.push(i);
//            }
//          }
//          // remove the tracks that were merged
//          for (var i = remove.length-1; i >= 0; i--) {
//            partitions[id].splice(remove[i], 1);
//          }
//          // save the new group
//          var group = clone(groups[id]);
//          group.genes = track_genes.slice(0);
//          partition_groups.push(group);
//        }
//        // order the new groups largest to smallest
//        partition_groups.sort(function (a, b) {
//          return b.genes.length-a.genes.length;
//        });
//        // add the new groups to the data
//        for (var i = 0; i < partition_groups.length; i++) {
//          partition_groups[i].genes = partition_groups[i].genes.map(
//                                      function(gene) {
//                                        gene.y = group_y;
//                                        return gene;
//                                      });
//          group_y++;
//          data.groups.push(partition_groups[i]);
//        }
//      }
//    }
//  }
//  
//  // sort the result tracks with some user defined function
//  if (opt.sort !== undefined) {
//    // remove the query from the groups array
//    var query = data.groups.splice(0, 1);
//    // sort the results with the user defined function
//    data.groups.sort(opt.sort);
//    // set the groups array to the query concatenated with the sorted results
//    data.groups = query.concat(data.groups);
//    // give each track the correct y value
//    for (var i = 0; i < data.groups.length; i++) {
//      for (var j = 0; j < data.groups[i].genes.length; j++) {
//        data.groups[i].genes[j].y = i;
//      }
//    }
//  }
//
//  // filter the tracks with the omit lists
//  var tracks = [];
//  for (var i = 0; i < data.groups.length; i++) {
//    if (opt.interTrack !== undefined && opt.interTrack == true) {
//      tracks.push(data.groups[i].genes.filter(function(g) {
//        return omit[data.groups[i].id].indexOf(g.uid) == -1;
//      }));
//    } else {
//      tracks.push(data.groups[i].genes);
//    }
//  }
//  
//  // get the family size map
//  var family_sizes = getFamilySizeMap(data);
//  
//  // get the family id name map
//  var family_names = getFamilyNameMap(data);
//  
//  var w = d3.max([1000, targetWidth]),
//      rect_h = 18,
//      rect_pad = 2,
//      top_pad = 50,
//      bottom_pad = 200,
//      pad = 20,
//      left_pad = 250,
//      right_pad = 150,
//      num_tracks = data.groups.length,
//      num_genes = get_track_length(data),
//  
//  // for constructing the y-axis
//  var tick_values = [];
//  
//  // add the tracks (groups)
//  for (var i = 0; i < data.groups.length; i++) {
//  	// add the group to the y-axis
//  	tick_values.push(i);
//  
//  	// make svg groups for the genes
//  	var selector = ".gene-"+i.toString();
//  	var gene_groups = viewer.selectAll(selector)
//  	  .data(tracks[i])
//  	  .enter()
//  	  .append("g")
//  	  .attr("class", "gene")
//  	  .attr("transform", function (d) {
//  	    return "translate("+x(d.x)+", "+y(d.y)+")";
//  	  });
//  
//  	// add genes to the svg groups
//  	gene_groups.append("path")
//  	  .attr("d", d3.svg.symbol().type("triangle-up").size(200))
//  	  .attr("class", function (d) {
//  	  	if (opt.focus !== undefined && (opt.focus == d.family || opt.focus == d.name)) {
//  	  	  return "point focus";
//  	  	} else if (d.family == '') {
//  	  	  return "point no_fam";
//  	  	} else if (family_sizes[d.family] == 1 && 
//                   opt.selectiveColoring !== undefined &&
//                   opt.selectiveColoring == true) {
//  	  	  return "point single";
//  	  	} return "point";
//      })
//  	  .attr("transform", function (d) {
//        return "rotate("+((d.strand == 1) ? "90" : "-90")+")";
//      })
//  	  .style("fill", function (d) {
//  	  	if (d.family == '' ||
//            (opt.selectiveColoring !== undefined &&
//             opt.selectiveColoring == true &&
//             family_sizes[d.family] == 1)) {
//  	  	  return "#ffffff";
//  	  	} return color(d.family);
//  	  })
//  	  .style("cursor", "pointer");
//  
//  	gene_groups.on("mouseover", function (d) {
//		var selection = d3.selectAll(".gene").filter(function(e) {
//		  return e.id == d.id;
//		});
//  	    showTips(selection);
//  	  })
//  	  .on("mouseout", function (d) {
//		var selection = d3.selectAll(".gene").filter(function(e) {
//		  return e.id == d.id;
//		});
//  	    hideTips(selection);
//  	  })
//  	  .on('click', function (d) {
//        if (opt.geneClicked !== undefined) {
//  	  	   opt.geneClicked(d);
//        }
//  	  });
//  
//  	// add the tooltips
//  	gene_groups.append("text")
//  	  .attr("class", "tip")
//  	  .attr("transform", "translate(3, 14) rotate(45)")
//  	  .attr("text-anchor", "left")
//  	  .text(function (d) {
//  	    return d.name+": "+d.fmin+" - "+d.fmax;
//  	  });
//  
//  	// helper that draws lines between two given genes
//    function draw_line(a, b) {
//  	  var length = x(a.x)-x(b.x);
//  	  var rail_group = viewer.append("g")
//  	    .attr("class", "rail")
//  	    .attr("transform", function () {
//  	      return "translate("+x(b.x)+", "+y(b.y)+")";
//  	    })
//  	    .attr("y", b.y) // does nothing besides hold the datum
//  	    .data(function () {
//  	      if (a.fmin > b.fmax) {
//  	        return [a.fmin-b.fmax];
//  	      }
//  	      return [b.fmin-a.fmax];
//  	    });
//  	  rail_group.append("line")
//  	  	.attr("class", "line")
//  	  	.attr("x1", 0)
//  	  	.attr("x2", length)
//  	  	.attr("y1", 0)
//  	  	.attr("y2", y(a.y)-y(b.y));
//  	  rail_group.append("text")
//  	  	.attr("class", "tip")
//  	  	.attr("transform", "translate("+(length/2)+", -10) rotate(-45)")
//  	  	.attr("text-anchor", "left")
//  	  	.text(function (d) {
//  	      return rail_group.data();
//  	  	});
//  	  rail_group.moveToBack();
//    }
//  
//  	// add rails to the tracks
//    var partition = false;
//  	gene_groups.each(function (d) {
//  	  var closest;
//  	  var neighbors = gene_groups.filter(function (n) {
//  	  	return n.y == d.y;
//  	  });
//  	  neighbors.each(function (n) {
//  	  	if (n.x < d.x && (closest === undefined || n.x > closest.x)) {
//  	  	  closest = n;
//  	  	}
//  	  });
//      if (opt.interTrack !== undefined && opt.interTrack == true) {
//        if (closest !== undefined &&
//            !(left_breaks[d.group_id].indexOf(d.uid) != -1 &&
//              right_breaks[closest.group_id].indexOf(closest.uid) != -1)) {
//          draw_line(d, closest);
//        }
//        var inter = interTracks[d.group_id][d.uid];
//        // some inter-track lines may have been noted before a participating
//        // gene was omitted
//        if (inter !== undefined &&
//            omit[inter.group_id].indexOf(inter.uid) == -1) {
//          draw_line(d, interTracks[d.group_id][d.uid]);
//        }
//      } else if (closest !== undefined) {
//        draw_line(d, closest);
//      }
//  	});
//  }
//  
//  // make global group selections
//  var gene_groups = viewer.selectAll(".gene"),
//  	  rail_groups = viewer.selectAll(".rail");
//  
//  // make thickness of lines a function of their "length"
//  var max_width = d3.max(rail_groups.data());
//  var min_width = d3.min(rail_groups.data());
//  var width = d3.scale.linear()
//    .domain([min_width, max_width])
//    .range([.1, 5]);
//  rail_groups.attr("stroke-width", function (d) { return width(d); });
//  
//  // construct the y-axes
//  var yAxis_left = d3.svg.axis().scale(y).orient("left")
//    .tickValues(tick_values) // we don't want d3 taking liberties
//    .tickFormat(function (d, i) {
//      var l = data.groups[d].genes.length;
//      if (d > 0 && data.groups[d-1].id === data.groups[d].id) {
//        return (l > 0 ?
//          (data.groups[d].genes[0].fmin+"-"+data.groups[d].genes[l-1].fmax) :
//          "");
//      }
//      return data.groups[d].chromosome_name +":"+(l > 0 ?
//        (data.groups[d].genes[0].fmin+"-"+data.groups[d].genes[l-1].fmax) :
//        "");
//    });
//  
//  // draw the axes of the graph
//  viewer.append("g")
//    .attr("class", "axis axis_left")
//    .attr("transform", "translate("+(left_pad-pad)+", 0)")
//    .call(yAxis_left);
//  
//  if (opt.rightAxisClicked !== undefined) {
//    var yAxis_right = d3.svg.axis().scale(y).orient("right")
//      .tickValues(tick_values) // we don't want d3 taking liberties
//      .tickFormat(function (d, i) {
//        if (d > 0 && data.groups[d-1].id === data.groups[d].id) {
//          return "";
//        }
//        return "plot";
//      });
//    viewer.append("g")
//      .attr("class", "axis axis_right")
//      .attr("transform", "translate("+(w-right_pad+pad)+", 0)")
//      .call(yAxis_right);
//    var yAxis_right = d3.svg.axis().scale(y).orient("right")
//      .tickValues(tick_values) // we don't want d3 taking liberties
//      .tickFormat("plot");
//  }
//  
//  // interact with the y-axes
//  d3.selectAll(".axis_left text")
//    .style("font-weight", function(d, y) {
//      if (opt.boldFirst !== undefined && opt.boldFirst && y == 0) {
//        return "bold";
//      } return "normal"; })
//  	.style("cursor", "pointer")
//      .on("mouseover", function (d, y) {
//  		var gene_selection = gene_groups.filter(function (e) {
//  		  return e.y == y;
//  		});
//  		var rail_selection = rail_groups.filter(function (e) {
//          // select lines only on the track (not inter-track lines)
//  	      return (d3.select(this).attr("y") == y &&
//          d3.select(this).select("line").attr("y1") == 0 &&
//          d3.select(this).select("line").attr("y2") == 0);
//  		});
//  		showTips(gene_selection, rail_selection);
//      })
//      .on("mouseout",  function (d, y) {
//  		var gene_selection = gene_groups.filter(function (e) {
//  	      return e.y == y;
//  		});
//  		var rail_selection = rail_groups.filter(function (e) {
//  		  return d3.select(this).attr("y") == y;
//  		});
//  		hideTips(gene_selection, rail_selection);
//      })
//      .on("click", function (d, y){
//  		var gene_selection = gene_groups.filter(function (e) {
//  		  return e.y == y;
//  		});
//  		var rail_selection = rail_groups.filter(function (e) {
//  		  return d3.select(this).attr("y") == y;
//  	    });
//        if (opt.leftAxisClicked !== undefined) {
//  		  opt.leftAxisClicked(data.groups[d].id,
//            gene_selection, rail_selection);
//        }
//  	  });
//  d3.selectAll(".axis_right text")
//    .style("cursor", "pointer")
//    .on("click", function (d, y) {
//      var gene_selection = gene_groups.filter(function (e) {
//      	return e.y == y;
//      });
//      var rail_selection = rail_groups.filter(function (e) {
//      	return d3.select(this).attr("y") == y;
//      });
//      // called if opt.rightAxisClicked !== undefined
//      opt.rightAxisClicked(data.groups[d].id);
//    });

  // Private

  // Constants
  _PAD = 2;
  _TRACK_HEIGHT = 30;

  /**
    * Computes the length of the longest string in the given array.
    * @param {array} text - The strings to be measured.
    * @return {number} The length of the longest string.
    */
  _longestString(text) {
    var dummy = this.viewer.append('g'),
        max = 0;
		dummy.selectAll('.dummyText')
		  .data(text)
		  .enter()
		  .append('text')
		  .text(function (s) { return s; })
		  .each(function (s, i) {
		    var l = this.getComputedTextLength();
        if (l > max) max = l;
		    this.remove();
		  });
		dummy.remove();
    return max;
  }

  /** Resizes the viewer and x scale. Will be decorated by other components. */
  _resize() {
    var w = this.container.clientWidth,
        r1 = this.left + (2 * this._PAD),
        r2 = w - (this.right + this._PAD);
    this.viewer.attr('width', w);
    this.x.range([r1, r2]);
  }

  /**
    * Decorates the _resize function with the given function.
    * @param {function} d - The decorator function.
    */
  _decorateResize(d) {
    this._resize = function (resize) {
      resize();
      d();
    }.bind(this, this._resize);
  }

  /**
    * Parses parameters and initializes variables.
    * @param {string} id - ID of element viewer will be drawn in.
    * @param {object} data - The data the viewer will visualize.
    * @param {object} options - Optional parameters.
    */
  _init(id, data, options) {
    // parse positional parameters
    this.container = document.getElementById(id);
    if (this.container === null) {
      throw new Error('"' + id + '" is not a valid element ID');
    }
    this.data = data;
    if (this.data === undefined) {
      throw new Error("'data' is undefined");
    }
    // create the viewer
    this.viewer = d3.select('#' + id)
      .append('svg')
      .attr('class', 'GCV')
      .attr('height', this._PAD);
    // compute the x scale and the space required for track names
    var minX = Infinity,
        maxX = -Infinity;
		var names = data.groups.map(function (g) {
      var min = Infinity,
          max = -Infinity;
      for (var i = 0; i < g.genes.length; i++) {
        var gene = g.genes[i],
            fmax = gene.fmax,
            fmin = gene.fmin,
            x = gene.x;
        min = Math.min.apply(null, [min, fmax, fmin]);
        max = Math.max.apply(null, [max, fmax, fmin]);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
      return g.chromosome_name + ':' + min + '-' + max;
    });
    this.left = this._longestString(names);
    // initialize the x and y scales
    this.x = d3.scale.linear().domain([minX, maxX]);
    var numTracks = data.groups.length,
        bottom = this._PAD + (this._TRACK_HEIGHT * numTracks);
    this.y = d3.scale.linear().domain([0, numTracks - 1])
               .range([this._PAD, bottom]);
    // parse optional parameters
    this.options = options || {};
    this.options.nameClick = options.nameClick || function (y, i) { };
    this.options.geneClick = options.geneClick || function (b) { };
    this.options.plotClick = options.plotClick;
    this.options.autoResize = options.autoResize || false;
    // set the right padding
    this.right = (options.plotClick) ? this._longestString(['plot']) : this._PAD;
    // make sure resize always has the right context
    this._resize = this._resize.bind(this);
    // initialize the viewer width and x scale range
    this._resize();
  }

  /** Draws the viewer. */
  //_draw() {
  //  // draw the x-axis
  //  var xAxis = this._drawXAxis(),
  //      m = this._positionElement(xAxis);
  //  // decorate the resize function with that of the x-axis
  //  this._decorateResize(xAxis.resize);
  //  // draw the tracks
  //  var ticks = [m],
  //      tracks = [];
  //  for (var i = 0; i < this.data.tracks.length; i++) {
  //    // make the track
  //    var track = this._drawTrack(i);
  //    // put it in the correct location
  //    m = this._positionElement(track);
  //    // save the track's label location
  //    ticks.push(m);
  //    // save the track for the resize call
  //    tracks.push(track);
  //  }
  //  // decorate the resize function with that of the track
  //  var resizeTracks = function () {
  //    tracks.forEach(function (t, i) {
  //      t.resize();
  //    });
  //  }
  //  this._decorateResize(resizeTracks);
  //  // rotate the tips now that all the tracks have been drawn
  //  tracks.forEach(function (t, i) {
  //    t.rotateTips();
  //  });
  //  // move all tips to front
  //  this.viewer.selectAll('.synteny-tip').moveToFront();
  //  // draw the y-axis
  //  var yAxis = this._drawYAxis(ticks);
  //  yAxis.attr('transform', 'translate(' + this.left + ', 0)');
  //  // draw the viewport
  //  if (this.options.viewport) {
  //    var viewport = this._drawViewport();
  //    this._decorateResize(viewport.resize);
  //  }
  //  // create an auto resize iframe if necessary
  //  if (this.options.autoResize) {
  //    this.resizer = this._autoResize(this.container, (e) => {
  //      this._resize();
  //    });
  //  }
  //}
  
  // Public

  /**
    * The constructor.
    * @param {string} id - ID of element viewer will be drawn in.
    * @param {object} data - The data the viewer will visualize.
    * @param {object} options - Optional parameters.
    */
  constructor(id, color, data, options) {
    console.log(data);
    this._init(id, data, options);
    //this._draw();
  }

  /** Manually destroys the viewer. */
  //destroy() {
  //  if (this.container) {
  //    this.container.removeChild(this.viewer.node());
  //    if (this.resizer) {
  //      this.container.removeChild(this.resizer);
  //    }
  //  }
  //  this.container = this.viewer = this.resizer = undefined;
  //}
}
