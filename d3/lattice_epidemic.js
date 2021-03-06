var blue = d3.rgb(100,100,200);

/* Global variables */
var nodes = [];
var width;
var height;
var N;
var day;
var MAX_DAYS;
var movementRatio;
var spreadRadiusFactor;
var infectedCompartments;
var simulateSpeed;
var radius;
var distRadius;
var pointGrid = d3.layout.grid().points();
var buckets = [];
var neighborCount = 0;
var neighborSum = 0;
var degreeOfContact;
var tick;
var smallSteps = false;
var bucketCounts_math = [];
var svg;



/* Plotly*/
var traceS = {};
var data = [];
var layout = {
  showlegend: true,
  legend: {
    x: 0.1,
    y: 1.2,
    orientation: 'h'
  }
};

var traceS_math = {};
var data_math = [];

/*
 * Compartment bucket.
 */
class Bucket {
  constructor(bucketConfig) {
    this.name = bucketConfig.name;
    this.color = bucketConfig.color;
    this.alpha = bucketConfig.alpha;
    this.nextState = bucketConfig.nextState;
    this.initRatio = bucketConfig.initRatio;
    this.contactSpreadFlag = bucketConfig.contactSpreadFlag;
    this.beta = bucketConfig.beta;
    this.q = bucketConfig.q;
    this.contactSpreadState = bucketConfig.contactSpreadState;
  }
}

/*
 * Get circle color.
 */
var getCircleColor = function(d,i) {
    var col = blue;
    for(var j=0; j < buckets.length; j++) {
      if(nodes[i].state == buckets[j].name) {
        return buckets[j].color;
      }
    }
    return col;
}

/*
 * Initialize the node values.
 */
var initNode = function(d,i) {
  var n = {};
  n.id = i;
  n.radius = radius;
  n.state = 'SUSCEPTIBLE';
  n.t = 0;
  return n;
}

/*
 * Initialize node states.
 */
function initState() {
  var stateIndex = 0;
  for(var j=0; j < buckets.length; j++) {
    if(buckets[j].initRatio > 0) {
      var stateCount = (buckets[j].initRatio)*(nodes.length);
      for(var k=stateIndex; k <= (stateIndex + stateCount); k++) {
         nodes[k].state = buckets[j].name;
      }
      stateIndex += stateCount;
    }
  }
}

/*
 * Start the simulation run.
 */
function startsim() {
  svg = d3.select("#epidemic").append("svg")
    .attr({
      width: width,
      height: height
    })
  .append("g");

  nodes = d3.range(N*N).map(initNode);
  initState();

  var point = svg.selectAll("circle")
    .data(pointGrid(nodes));
  point.enter().append("circle")
    .attr("class", "point")
    .attr("r", radius)
    .attr("id",function(d,i) {return 'individual-'+i;});

    svg.selectAll("circle").style("fill", getCircleColor);

}

/*
 * Distance between two circles
 */
function distance(x1,y1,x2,y2) {
  return Math.sqrt( ((x2-x1)*(x2-x1)) + ((y2-y1)*(y2-y1)) );
}

/*
 * Find closest neighbors.
 */
function closestNeighbors(ind){
  neighbors =[];
  var currentX = d3.select("#individual-"+ind).attr("cx");
  var currentY = d3.select("#individual-"+ind).attr("cy");

  for(var x=0; x < nodes.length; x++) {
    if(x != ind) {
      var nodeX = d3.select("#individual-"+x).attr("cx");
      var nodeY = d3.select("#individual-"+x).attr("cy");

      var d = distance(currentX, currentY, nodeX, nodeY);

      if (d > 0 && d < distRadius) {
        neighbors.push(x);
      }
    }
  }
  neighborCount++;
  neighborSum = neighborSum + neighbors.length;
  degreeOfContact = neighborSum/neighborCount;
  return neighbors;
}

/*
 * Contact transformation.
 */
function contactTx(sNode, neighbors, bucket) {
  for(var ni=0; ni < neighbors.length; ni++) {
       var nNode = nodes[neighbors[ni]];
       if(nNode.state == bucket.name && nNode.t != day) {
         if(Math.random() <= bucket.beta*bucket.q) {
           sNode.state = bucket.contactSpreadState;
           sNode.t = day;
           break;
         }
       }
  }
}

/*
 *  Transformation state change.
 */
function txState(currentNodes, txRate, newState) {
  for(var e=0; e < currentNodes.length; e++) {
      if(Math.random() < txRate && currentNodes[e].t != day) {
        currentNodes[e].state = newState;
        currentNodes[e].t = day;
      }
  }
}

function mathSimulate(sCount, bucketCounts) {
  var n = bucketCounts_math.length;
  if(n == 0) {
    var newCount = {};
    newCount['SUSCEPTIBLE'] = sCount;
    for(var j=0; j < buckets.length; j++) {
      newCount[buckets[j].name] = bucketCounts[buckets[j].name];
    }
    bucketCounts_math.push(newCount);
  } else {
    var newCount = {};
    var lastCount = bucketCounts_math[n-1];

    newCount['SUSCEPTIBLE'] = lastCount['SUSCEPTIBLE'];
    for(var j=0; j < buckets.length; j++) {
      newCount[buckets[j].name] = lastCount[buckets[j].name];
    }

    for(var j=0; j < buckets.length; j++) {
      if(buckets[j].alpha > 0) {
        var rate = lastCount[buckets[j].name] * buckets[j].alpha;
        newCount[buckets[j].name] = newCount[buckets[j].name] - rate;
        newCount[buckets[j].nextState] = newCount[buckets[j].nextState] + rate;
      }
      if(buckets[j].contactSpreadFlag) {
        var rate = buckets[j].beta * buckets[j].q * lastCount[buckets[j].name] * lastCount['SUSCEPTIBLE'] / (N*N);
        newCount['SUSCEPTIBLE'] = lastCount['SUSCEPTIBLE'] - rate;
        newCount[buckets[j].contactSpreadState] = newCount[buckets[j].contactSpreadState] + rate;
      }
    }

    bucketCounts_math.push(newCount);
  }

}

/*
 * Simiulate.
 */
function simulate() {
  randomMovement();

  var i=0,
  n = nodes.length;
  var bucketNodes = {};
  var bucketCounts = {};

  for(var j=buckets.length-1; j >= 0; j--) {
    bucketNodes[buckets[j].name] = [];
    bucketCounts[buckets[j].name] = 0;
  }

  var sCount = 0;
  for(i = 0; i<n; i++) {
    if (nodes[i].state != 'SUSCEPTIBLE') {
      bucketCounts[nodes[i].state]++;
    } else {
      sCount++;
    }
  }
  mathSimulate(sCount, bucketCounts);
  updateTableCounts(day, sCount, bucketCounts);
  updateGraph(day, sCount, bucketCounts);

  day++;
  if(day > MAX_DAYS) {
   clearInterval(tick);
  }

  // transform states
  for(i = 0; i<n; i++) {
    if(nodes[i].state != 'SUSCEPTIBLE') {
      for(var j=buckets.length-1; j >= 0; j--) {
        if(buckets[j].alpha > 0 && nodes[i].state == buckets[j].name) {
            bucketNodes[buckets[j].name].push(nodes[i]);
        }
      }
    }
  }

  for(var j=buckets.length-1; j >= 0; j--) {
    txState(bucketNodes[buckets[j].name],buckets[j].alpha, buckets[j].nextState);
  }

  // contact tx
  for(i = 0; i<n; i++) {
     if (nodes[i].state == 'SUSCEPTIBLE') {
      var neighbors = closestNeighbors(i);
      for(var j=buckets.length-1; j >= 0; j--) {
        if(buckets[j].contactSpreadFlag) {
          contactTx(nodes[i],neighbors, buckets[j]);
        }
      }
    }
  }

  svg.selectAll("circle").style("fill", getCircleColor);
}

/*
 * Update graph
 */
function updateGraph(day, sCount, bucketCounts) {
  d3.select("#degreeOfContact").text("Computed degreeOfContact = " + degreeOfContact);
  data[0].x.push(day);
  data[0].y.push(sCount);
  var lastMathCount = bucketCounts_math[bucketCounts_math.length-1];

  if(lastMathCount) {
    data_math[0].x.push(day);
    data_math[0].y.push(lastMathCount['SUSCEPTIBLE']);
  }

  for(var j=0; j < buckets.length; j++) {
    data[j+1].x.push(day);
    data[j+1].y.push(bucketCounts[buckets[j].name]);
    if(lastMathCount) {
      data_math[j+1].x.push(day);
      data_math[j+1].y.push(lastMathCount[buckets[j].name]);
    }
  }

  Plotly.newPlot('graphDiv',data, layout);
  Plotly.newPlot('graphDiv_math',data_math, layout);
}

/*
 * Update table rows.
 */
function updateTableRow(tCountsRow, day, sCount, bucketCounts) {
  tCountsRow.append('td').text(day)
  .attr("class","bucketCount");


  tCountsRow.append('td').text(sCount)
  .attr("class","bucketCount")
    .style("background-color",blue);;

  for(var j=0; j < buckets.length; j++) {
    var tdText = bucketCounts[buckets[j].name];
    tCountsRow.append('td').text(tdText)
    .attr("class","bucketCount")
    .style("background-color",buckets[j].color);
  }

}

/*
 * Update table counts.
 */
function updateTableCounts(day, sCount, bucketCounts) {
    d3.select("#tCountsRow").remove();
    d3.select("#tCountsRowMath").remove();

    var tCountsRow = d3.select('#tCounts').append('tr').attr('id', 'tCountsRow');
    var tDetailsRow = d3.select('#tData').append('tr');
    var tCountsMathRow = d3.select('#tCountsMath').append('tr').attr('id', 'tCountsRowMath');

    updateTableRow(tCountsRow,day, sCount, bucketCounts);
    updateTableRow(tDetailsRow, day, sCount, bucketCounts);
    updateTableRow(tCountsMathRow, day, bucketCounts_math[bucketCounts_math.length-1]['SUSCEPTIBLE'], bucketCounts_math[bucketCounts_math.length-1]);
}

/*
 * New position.
 */
function newPosition(currentP) {
  var sign = 1;
  var newP;
  if(Math.random()*100 > 50)
    sign = -1*sign;

  newP = parseFloat(currentP) + sign*(Math.random() * movementRatio);

  if(newP >= width - 10 || newP < 10) {
    newP = parseFloat(currentP) + sign*-1*(Math.random() * movementRatio);
  }
  return newP;
}

/*
 * Randomly move the circles.
 */
function randomMovement() {

  for(i = 0; i<nodes.length; i++){
    var currentX = d3.select("#individual-"+i).attr("cx");
    var currentY = d3.select("#individual-"+i).attr("cy");
    var cx,cy;

    if(smallSteps) {
      cx = newPosition(currentX);
      cy = newPosition(currentY);
    } else {
      cx = Math.random() * width;
      cy = Math.random() * height;
    }


    var circle = d3.select("#individual-"+i);
    circle.transition().duration(100)
        .attr("cx", cx)
        .attr("cy", cy)
        .each("end", function () {
    });

    var opacitySet = false;
    for(var j=0; j < buckets.length; j++) {
      if(nodes[i].state == buckets[j].name) {
        if(buckets[j].contactSpreadFlag) {
           opacitySet = true;
           circle.attr("stroke-width",(distRadius - radius))
           .attr("stroke",buckets[j].color)
           .attr("stroke-opacity","0.5");
         }
      }
    }

    if(!opacitySet) {
      circle.attr("stroke-width",'0px')
    }

  }
  smallSteps = true;
  svg.selectAll("circle").style("fill", getCircleColor);
}

/*
 * Run the simulation.
 */
function runSimulate(config) {
  if(tick)
    clearInterval(tick);
  reset(config);
  startsim();
  tick = setInterval(simulate, simulateSpeed);
}

function sei1i2rSimulate() {
  runSimulate(sei1i2rConfig);
}

function seirSimulate() {
  runSimulate(seirConfig);
}

function sirSimulate() {
   runSimulate(sirConfig);
}

function pause() {
  clearInterval(tick);
}



function resetGraph(){
  traceS = {
    x: [],
    y: [],
    name: 'Susceptible',
    type: 'scatter',
    mode: 'lines+markers',
    marker: {
      color: blue,
      size: 8
    }
  };
  traceS_math = {
    x: [],
    y: [],
    name: 'Susceptible',
    type: 'scatter',
    mode: 'lines+markers',
    marker: {
      color: blue,
      size: 8
    }
  };
  data = [traceS];
  data_math = [traceS_math];

  for(var j=0; j < buckets.length; j++) {
    var traceBucket =  {
      x: [],
      y: [],
      name: buckets[j].name,
      type: 'scatter',
      mode: 'lines+markers',
      marker: {
        color: buckets[j].color,
        size: 8
      }
    };
    var traceBucket_math =  {
      x: [],
      y: [],
      name: buckets[j].name,
      type: 'scatter',
      mode: 'lines+markers',
      marker: {
        color: buckets[j].color,
        size: 8
      }
    };
    data.push(traceBucket);
    data_math.push(traceBucket_math);
  }

  Plotly.newPlot('graphDiv',data, layout);
  Plotly.newPlot('graphDiv_math',data_math, layout);

}


function refreshTables() {
  d3.select("#tCountsRowHeading").remove();
  d3.select("#tCountsRowHeadingMath").remove();
  d3.select("#tData").selectAll("tr").remove();

  var tCountsRowHeading = d3.select('#tCounts').append('tr').attr('id', 'tCountsRowHeading');
  var tCountsRowMathHeading = d3.select('#tCountsMath').append('tr').attr('id', 'tCountsRowHeadingMath');
  var tDetailsRowHeading = d3.select('#tData').append('tr').attr('id', 'tDetailsRowHeading');

  tCountsRowHeading.append('th').text('Day');
  tCountsRowHeading.append('th').text('SUSCEPTIBLE');
  tCountsRowMathHeading.append('th').text('Day');
  tCountsRowMathHeading.append('th').text('SUSCEPTIBLE');
  tDetailsRowHeading.append('th').text('Day');
  tDetailsRowHeading.append('th').text('SUSCEPTIBLE');
  for(var j=0; j < buckets.length; j++) {
    tCountsRowHeading.append('th').text(buckets[j].name);
    tCountsRowMathHeading.append('th').text(buckets[j].name);
    tDetailsRowHeading.append('th').text(buckets[j].name);
  }
}

var sei1i2rConfig = {
  N:20,
  simulationPanel : {
    width:600,
    height:600
  },
  maxDays:60,
  simulateSpeed:1000,
  movementRatio:20,
  spreadRadiusFactor:2,
  radius:15,
  buckets: [
    {
      name: 'EXPOSED',
      color: "rgb(218, 247, 166)",
      alpha: 0.2,
      nextState: 'INFECTED_1',
      initRatio:0.02
    },
    {
      name: 'INFECTED_1',
      color: "rgb(255,87,51)",
      alpha: 0.2,
      nextState: 'INFECTED_2',
      contactSpreadFlag:true,
      beta:0.49,
      q:0.95,
      contactSpreadState:'EXPOSED'
    },
    {
      name: 'INFECTED_2',
      color: "rgb(144,12,63)",
      alpha: 1/9,
      nextState: 'RECOVERED'
    },
    {
      name: 'RECOVERED',
      color: "rgb(200,200,200)"
    }
  ]
};

var sirConfig = {
    N: 20,
    simulationPanel: {
        width: 600,
        height: 600
    },
    maxDays: 60,
    movementRatio: 20,
    spreadRadiusFactor: 2,
    simulateSpeed:1000,
    radius: 15,
    buckets: [
        {
            name: "INFECTED",
            color: "rgb(255,87,51)",
            alpha: 0.11,
            nextState: "RECOVERED",
            contactSpreadFlag: true,
            beta: 0.49,
            q: 0.95,
            contactSpreadState: "INFECTED",
            initRatio: 0.02
        },
        {
            name: "RECOVERED",
            color: "rgb(200,200,200)"
        }
    ]
};

var seirConfig = {
    N: 20,
    simulationPanel: {
        width: 600,
        height: 600
    },
    maxDays: 60,
    movementRatio: 20,
    spreadRadiusFactor: 3,
    simulateSpeed:1000,
    radius: 10,
    buckets: [
     {
    name: "EXPOSED",
    color: "rgb(218, 247, 166)",
    alpha: 0.2,
    nextState: "INFECTED",
    initRatio: 0.02
      },
        {
            name: "INFECTED",
            color: "rgb(255,87,51)",
            alpha: 0.11,
            nextState: "RECOVERED",
            contactSpreadFlag: true,
            beta: 0.49,
            q: 0.95,
            contactSpreadState: "EXPOSED",
            initRatio: 0.02
        },
        {
            name: "RECOVERED",
            color: "rgb(200,200,200)"
        }
    ]
};

function updateParameter() {
  var config = JSON.parse(d3.select("#parametersJson").node().value);
  runSimulate(config);
}

function reset(config) {
  N = config.N;
  width = config.simulationPanel.width;
  height = config.simulationPanel.height;
  MAX_DAYS = config.maxDays;
  movementRatio = config.movementRatio;
  spreadRadiusFactor = config.spreadRadiusFactor;
  radius = config.radius;
  simulateSpeed = config.simulateSpeed;
  buckets = [];
  bucketCounts_math = [];

  for(var i in config.buckets){
    buckets.push(new Bucket(config.buckets[i]));
  }

  day = 0;
  distRadius = radius*spreadRadiusFactor;

  d3.select("#parametersJson").text(JSON.stringify(config,undefined, 4));

  refreshTables();
  resetGraph();
  nodes = [];
  smallSteps = false;
  d3.select("svg").remove();

}

//reset(defaultConfig);
Plotly.newPlot('graphDiv', data, layout);
Plotly.newPlot('graphDiv_math', data_math, layout);
