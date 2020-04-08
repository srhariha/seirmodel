var blue = d3.rgb(100,100,200);

var nodes = [];

var width = 600,
    height = 600,
    N;

var day;
var MAX_DAYS;
var movementRatio;
var spreadRadiusFactor;
var infectedCompartments;
var simulateSpeed;

var radius;
var distRadius;

var pointGrid = d3.layout.grid()
  .points();

var svg;

/* Plotly*/
var traceS = {};
var data = [];

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

var buckets = [];

var getCircleColor = function(d,i) {
    var col = blue;
    for(var j=0; j < buckets.length; j++) {
      if(nodes[i].state == buckets[j].name) {
        return buckets[j].color;
      }
    }
    return col;
}

var initNode = function(d,i) {
  var n = {};
  n.id = i;
  n.radius = radius;
  n.state = 'SUSCEPTIBLE';
  n.t = 0;
  return n;
}

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


function distance(x1,y1,x2,y2) {
  return Math.sqrt( ((x2-x1)*(x2-x1)) + ((y2-y1)*(y2-y1)) );
}

var neighborCount = 0;
var neighborSum = 0;
var degreeOfContact;

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

function txState(currentNodes, txRate, newState) {
  for(var e=0; e < currentNodes.length; e++) {
      if(Math.random() < txRate && currentNodes[e].t != day) {
        console.log("[node-" + e + " changed from " + currentNodes[e].state + " to " + newState);
        currentNodes[e].state = newState;
        currentNodes[e].t = day;
      }
  }
}


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
  updateTableCounts(day, sCount, bucketCounts);
  updateGraph(day, sCount, bucketCounts);

  day++;
  if(day > MAX_DAYS) {
   clearInterval(tick);
  }


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

function updateGraph(day, sCount, bucketCounts) {
  d3.select("#degreeOfContact").text("Computed degreeOfContact = " + degreeOfContact);
  data[0].x.push(day);
  data[0].y.push(sCount);

  for(var j=0; j < buckets.length; j++) {
    data[j+1].x.push(day);
    data[j+1].y.push(bucketCounts[buckets[j].name]);
  }

  Plotly.newPlot('graphDiv',data);
}

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

function updateTableCounts(day, sCount, bucketCounts) {
    d3.select("#tCountsRow").remove();
    var tCountsRow = d3.select('#tCounts').append('tr').attr('id', 'tCountsRow');
    var tDetailsRow = d3.select('#tData').append('tr');
    updateTableRow(tCountsRow,day, sCount, bucketCounts);
    updateTableRow(tDetailsRow, day, sCount, bucketCounts);
}

var smallSteps = false;

function randomMovement() {

  for(i = 0; i<nodes.length; i++){
    var currentX = d3.select("#individual-"+i).attr("cx");
    var currentY = d3.select("#individual-"+i).attr("cy");
    var cx,cy;
    var sign = 1;

    if(smallSteps) {
      if(Math.random()*100 > 50)
        sign = -1*sign;

      cx = parseFloat(currentX) + sign*(Math.random() * movementRatio);

      if(cx >= width - 10 || cx < 10) {
        cx = parseFloat(currentX) + sign*-1*(Math.random() * movementRatio);
      }

      if(Math.random()*100 > 50)
        sign = -1*sign;

      cy = parseFloat(currentY) + sign*(Math.random() * movementRatio);

      if(cy >= height - 10 || cy < 10) {
        cy = parseFloat(currentY) + sign*-1*(Math.random() * movementRatio);
      }
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

var tick;

function simulateButtonClick() {
   startsim();
   //randomMovement();
   tick = setInterval(simulate, simulateSpeed);
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
  data = [traceS];

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
    data.push(traceBucket);
  }
  Plotly.newPlot('graphDiv',data);
}


function refreshTables() {
  d3.select("#tCountsRowHeading").remove();
  d3.select("#tDetailsRowHeading").remove();

  var tCountsRowHeading = d3.select('#tCounts').append('tr').attr('id', 'tCountsRowHeading');
  var tDetailsRowHeading = d3.select('#tData').append('tr').attr('id', 'tDetailsRowHeading');

  tCountsRowHeading.append('th').text('Day');
  tCountsRowHeading.append('th').text('SUSCEPTIBLE');
  tDetailsRowHeading.append('th').text('Day');
  tDetailsRowHeading.append('th').text('SUSCEPTIBLE');
  for(var j=0; j < buckets.length; j++) {
    tCountsRowHeading.append('th').text(buckets[j].name);
    tDetailsRowHeading.append('th').text(buckets[j].name);
  }
}

var defaultConfig = {
  N:20,
  simulationPanel : {
    width:600,
    height:600
  },
  maxDays:60,
  simulateSpeed:1000,
  movementRatio:30,
  spreadRadiusFactor:2,
  radius:20,
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


function updateParameter() {
  var config = JSON.parse(d3.select("#parametersJson").node().value);
  reset(config);
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

reset(defaultConfig);
Plotly.newPlot('graphDiv', data);
