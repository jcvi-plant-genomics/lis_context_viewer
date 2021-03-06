import { d3 }         from './d3';
import { Visualizer } from './visualizer';


/** The dot plot viewer. */
export class Plot extends Visualizer {

  // Private
  private bottom: number;
  private left: number;
  private maxX: number;
  private maxY: number;
  private minX: number;
  private minY: number;
  private outliers: number;
  private right: number;
  private top: number;
  private xScale: any;
  private yScale: any;

  // Constants
  private RADIUS: number;

  /** Resizes the viewer and x scale. Will be decorated by other components. */
  protected resize() {
    // viewer
    var w = this.container.clientWidth;
    this.viewer.attr('width', w).attr('height', w);
    // xAxis
    this.xScale.range([this.left, w - this.right]);
    // yAxis
    this.yScale.range([w - this.bottom, this.top]);
  }

  /**
    * Parses parameters and initializes variables.
    * @param {HTMLElement|string} el - ID of or the element itself where the
    * viewer will be drawn in.
    * @param {object} colors - D3 family-to-color map.
    * @param {object} data - The data the viewer will visualize.
    * @param {object} options - Optional parameters.
    */
  protected init(el, colors, data, options) {
    super.init(el, colors, data);
    this.RADIUS = 3.5;
    this.top    = this.PAD;
    this.left   = this.PAD;
    this.bottom = this.PAD;
    this.right  = this.PAD + this.RADIUS;
    // create the scales used to plot genes
    this.xScale = d3.scale.linear();
    this.yScale = d3.scale.linear();
    // parse optional parameters
    this.options                   = Object.assign({}, options);
    this.options.selectiveColoring = this.options.selectiveColoring;
    this.options.geneClick         = this.options.geneClick ||
      function (selection) { };
    this.options.plotClick         = this.options.plotClick ||
      function (plot) { };
    this.options.brushup           = this.options.brushup ||
      function (brushed) { };
    this.options.autoResize        = this.options.autoResize || false;
    this.options.outlier           = this.options.outlier || undefined;
    this.options.hoverDelay        = this.options.hoverDelay || 500;
    if (this.options.contextmenu)
      this.viewer.on('contextmenu', () => {
        this.options.contextmenu(d3.event);
      });
    if (this.options.click)
      this.viewer.on('click', () => {
        this.options.click(d3.event);
      });
    super.initResize();
  }

  /**
    * Creates the outliers portion above the track.
    * @return {object} - D3 selection of the outliers group.
    */
  private drawOutliers() {
    var outliers = this.viewer.append('text')
      .attr('class', 'label outliers')
      .text('Outliers')
      .style('text-anchor', 'end')
      .style('dominant-baseline', 'hanging');
    return outliers;
  }

  /**
    * Creates the x-axis label.
    * @return {object} - D3 selection of the label.
    */
  private drawXLabel() {
    var label = this.viewer.append('text')
      .attr('class', 'label plot-label')
      .text(this.data.chromosome_name);
    label.resize = function () {
      label.style('text-anchor', 'middle').attr('transform', (b) => {
        var range = this.xScale.range(),
            x = (range[0] + range[1]) / 2;
        return 'translate(' + x + ', 0)';
      });
    }.bind(this);
    label.resize();
    return label;
  }

  /**
    * Creates the x-axis, placing labels at their respective locations.
    * @return {object} - D3 selection of the y-axis.
    */
  private drawXAxis() {
    var xCoords = this.data.genes.map(g => g.x);
    this.minX = Math.min.apply(null, xCoords);
    this.maxX = Math.max.apply(null, xCoords);
    var mid = (this.minX + this.maxX) / 2;
    this.xScale.domain([this.minX, this.maxX]);
    // draw the axis
    var xAxis = this.viewer.append('g').attr('class', 'axis');
    // how the axis is resized
    xAxis.resize = function () {
      // update the axis
      var axis = d3.svg.axis()
        .scale(this.xScale)
        .orient('bottom')
        .tickValues(this.xScale.domain().map(Math.trunc))
        .tickFormat((x, i) => x);
      xAxis.call(axis)
        .selectAll('.tick text')
        .style('text-anchor', (t, i) => {
          if (i % 2 == 0) return 'start';
          return 'end';
        });
      xAxis.axis = axis;
    }.bind(this);
    // resize once to position everything
    xAxis.resize();
    return xAxis;
  }

  /**
    * Creates the y-axis, placing labels at their respective locations.
    * @return {object} - D3 selection of the y-axis.
    */
  private drawYAxis() {
    var yCoords = this.data.genes.reduce((l, g) => {
          if (g.y != this.options.outlier) l.push(g.y);
          return l;
        }, []);
    this.minY = Math.min.apply(null, yCoords);
    this.maxY = Math.max.apply(null, yCoords);
    var mid = (this.minY + this.maxY) / 2;
    this.yScale.domain([this.minY, this.maxY]);
    // draw the axis
    var yAxis = this.viewer.append('g').attr('class', 'axis');
    //// add the label
    //var label = yAxis.append('text')
    //  .attr('class', 'label')
    //  .text(this.data.chromosome_name);
    // how the axis is resized
    yAxis.resize = function () {
      // update the axis
      var axis = d3.svg.axis()
        .scale(this.yScale)
        .orient('left')
        .tickValues(this.yScale.domain().map(Math.trunc))
        .tickFormat((y, i) => y);
      yAxis.call(axis)
        .selectAll('text')
        .style('text-anchor', 'end')
        .style('dominant-baseline', (t, i) => {
          if (i == 0) return 'text-after-edge';
          return 'hanging';
        });
      //label.style('text-anchor', 'middle').attr('transform', (b) => {
      //  return 'translate(' + this.xScale(mid) + ', 0)';
      //});
    }.bind(this);
    // resize once to position everything
    yAxis.resize();
    return yAxis;
  }

  /**
    * Creates a graphic containing the plotted gene points.
    * @return {object} - D3 selection of the points.
    */
  private drawPoints() {
    var obj = this;
    var points = this.viewer.append('g');
    // create the gene groups
    points.geneGroups = points.selectAll('gene')
  	  .data(this.data.genes)
  	  .enter()
      .append('g')
      .attr('class', 'gene')
      .attr('data-gene', g => g.id)
      .attr('data-family', g => g.family)
  	  .style('cursor', 'pointer')
      .on('mouseover', function (g) {
        var gene = '.GCV [data-gene="' + g.id + '"]',
            family = '.GCV [data-family="' + g.family + '"]';
        var selection = d3.selectAll(gene + ', ' + family)
          .filter(function () {
            var d = this.getAttribute('data-gene');
            return d === null || d == g.id;
          });
        obj.beginHover(selection);
      })
  	  .on('mouseout', function (g) {
        var gene = '.GCV [data-gene="' + g.id + '"]',
            family = '.GCV [data-family="' + g.family + '"]';
        var selection = d3.selectAll(gene + ', ' + family)
          .filter(function () {
            var d = this.getAttribute('data-gene');
            return d === null || d == g.id;
          });
        obj.endHover(selection);
      })
  	  .on('click', (g) => this.options.geneClick(g, this.data));
  	// add genes to the gene groups
  	var genes = points.geneGroups.append('circle')
      .attr('r', this.RADIUS)
  	  .style('stroke', '#000')
  	  .style('cursor', 'pointer')
  	  .attr('class', function(e) {
  	  	if (e.family == '') {
  	  	  return 'no_fam';
  	  	} return ''; })
  	  .style('fill', (g) => {
  	  	if (g.family == '' ||
        (this.options.selectiveColoring !== undefined &&
        this.options.selectiveColoring[g.family] == 1)) {
  	  	  return '#ffffff';
  	  	} return this.colors(g.family);
  	  });
    // add tooltips to the gene groups
    var geneTips = points.geneGroups.append('text')
      .attr('class', 'synteny-tip')
  	  .attr('text-anchor', 'middle')
  	  .text(function (g) { return g.name + ': ' + g.fmin + ' - ' + g.fmax; })
      .attr('transform', 'rotate(-45)');
    // how the track is resized
    points.resize = function (geneGroups) {
  	  geneGroups.attr('transform', (g) => {
        var x = this.xScale(g.x),
            y = (g.y == this.options.outlier) ? this.outliers : this.yScale(g.y);
        return 'translate(' + x + ', ' + y + ')'
      });
    }.bind(this, points.geneGroups);
    points.resize();
    return points;
  }

  /**
    * Draws the viewer.
    * @param {object} points - D3 selection of points area.
    * @param {object} xAxis - D3 selection of the x-axis.
    * @return {object} - D3 selection of the clearButton.
    */
  private drawBrush(geneGroups, xAxis) {
    var obj = this;
    // the plot's brush
    var clearButton = obj.viewer.append('text')
          .attr('class', 'clear-button')
          .text('Clear Brush')
          .style('text-anchor', 'middle')
          .style('cursor', 'pointer')
          .style('visibility', 'hidden')
          .on('click', function (){
            obj.xScale.domain([obj.minX, obj.maxX]);
            transitionData();
            resetAxis();
            clearButton.style('visibility', 'hidden');
          });
    var extent;
    var brush = d3.svg.brush().x(this.xScale).y(this.yScale)
        .on('brush', brushmove)
        .on('brushend', brushend);
    var brushG = this.viewer.append('g')
        .attr('class', 'brush')
        .call(brush).on('click', () => {
          if (extent[0][0] == extent[1][0])
            this.options.plotClick(this.data);
        });
    clearButton.resize = function (brush, brushG) {
      brush.x(this.xScale).y(this.yScale);
      brushG.call(brush);
      clearButton.attr('x', () => {
        var range = this.xScale.range();
        return this.left + (range[1] - range[0]) / 2;
      });
    }.bind(this, brush, brushG);
    // drawing stuffs
    function brushmove () {
      extent = brush.extent();
    	extent[0][1] = obj.maxY;
    	extent[1][1] = obj.minY;
    	brush.extent(extent);
    	brushG.call(brush);
      geneGroups.classed('selected', function (e) {
        var isBrushed = extent[0][0] <= e.x && e.x <= extent[1][0];
        return isBrushed;
      });
    }
    function brushend() {
      if (extent[0][0] != extent[1][0]) {
        clearButton.style('visibility', 'visible');
        obj.xScale.domain([extent[0][0], extent[1][0]]);
        transitionData();
        resetAxis();
        geneGroups.classed('selected', false);
    	  brushG.call(brush.clear());
      }
    }
    function transitionData() {
    	var domain = obj.xScale.domain();
    	geneGroups.transition()
    	    .duration(500)
    	    .attr('transform', function (g) {
            var x = obj.xScale(g.x),
                y = (g.y == obj.options.outlier) ? obj.outliers : obj.yScale(g.y);
            return 'translate(' + x + ', ' + y + ')'
          })
    	    .attr('visibility', function (e) {
    	      if (e.x < domain[0] || e.x > domain[1]) return 'hidden';
    	      return 'visible';
    	    });
    }
    function resetAxis() {
    	xAxis.axis.tickValues(obj.xScale.domain().map(Math.trunc));
      xAxis.transition().duration(500).call(xAxis.axis)
        .selectAll('.tick:last-of-type text')
        .style('text-anchor', 'end');
    }
    return clearButton;
  }

  /** Draws the viewer. */
  protected draw() {
    // draw the x-axis
    var xAxis = this.drawXAxis();
    this.bottom = xAxis.node().getBBox().height + this.PAD;
    this.decorateResize(() => {
      xAxis.resize();
      var y = this.viewer.attr('height') - this.bottom;
      xAxis.attr('transform', 'translate(0, ' + y + ')');
    });
    var xLabel = this.drawXLabel();
    this.bottom += (2 * this.PAD) + xLabel.node().getBBox().height;
    this.decorateResize(() => {
      xLabel.resize();
      var y = this.viewer.attr('height') -
              this.bottom +
              xAxis.node().getBBox().height +
              xLabel.node().getBBox().height;
      xLabel.attr('y', y);
    });
    // draw the y-axis
    var yAxis = this.drawYAxis();
    this.left = yAxis.node().getBBox().width + this.PAD;
    yAxis.attr('transform', 'translate(' + this.left + ', 0)');
    //this.left += this.PAD;
    this.decorateResize(yAxis.resize);
    // draw the outliers label
    if (this.options.outlier !== undefined && this.data.genes.some((g) => {
      return g.y == this.options.outlier;
    })) {
      var _outliers = this.drawOutliers();
      _outliers.attr('x', this.left).attr('y', this.top);
      var h = _outliers.node().getBBox().height;
      this.outliers = this.top + (h / 2);
      this.top += h + this.PAD;
    } else {
      this.top += this.RADIUS;
    }
    // plot the gene points
    var points = this.drawPoints();
    this.decorateResize(points.resize);
    // draw the brush
    var clearButton = this.drawBrush(points.geneGroups, xAxis);
    this.bottom += clearButton.node().getBBox().height + this.PAD;
    this.decorateResize(() => {
      clearButton.resize();
      var y = this.viewer.attr('height') - this.PAD;
      clearButton.attr('y', y);
    });
    points.moveToFront();
    // resize so the axis fit correctly
    this.resize();
    // create an auto resize iframe, if necessary
    if (this.options.autoResize) {
      this.resizer = this.autoResize(this.container, (e) => {
        this.resize();
      });
    }
    this.resize();
  }
  
  // Public

  /** Makes a copy of the SVG and inlines external GCV styles. */
  protected inlineCopy() {
    return super.inlineCopy((clone) => {
      clone.select('.clear-button').remove();
    });
	}
}
