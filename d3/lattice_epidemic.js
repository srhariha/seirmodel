var blue = d3.rgb(100,100,200),
    exposedColor = d3.rgb(218, 247, 166), // Exposed
    infectedOneColor = d3.rgb(255,87,51), // Infected_one
    infectedTwoColor = d3.rgb(144, 12, 63 ), // Infected_two`
    recoveredColor = d3.rgb(200,200,200), // Recovered
    infectedOneStrokeColor = d3.rgb(251, 223, 234);

var beta,
    q,
    alphaOne,
    alphaTwo,
    gamma,
    initExposeRatio;

var nodes = [];
var tableData = [];
var tableColumns = ['SUSCEPTIBLE', 'EXPOSED','INFECTED_ONE','INFECTED_TWO','RECOVERED'];

var width = 600,
    height = 600,
    N;

var day;
var MAX_DAYS;
var movementRatio;
var spreadRadiusFactor;


var radius;
var distRadius;

var pointGrid = d3.layout.grid()
  .points();

var svg;

/* Plotly*/
var traceS = {};
var traceE = {};
var traceI1 = {};
var traceI2 = {};
var traceI = {};
var traceR = {};
var t = 0;
var data = [traceS, traceE, traceI1,traceI2,traceI,traceR];


var getCircleColor = function(d,i) {
    var col = blue;
    if (nodes[i].state == 'EXPOSED'){
        col = exposedColor;
    } else if (nodes[i].state == 'INFECTED_ONE'){
        col = infectedOneColor;
    } else if (nodes[i].state == 'INFECTED_TWO'){
        col = infectedTwoColor;
    } else if(nodes[i].state == 'RECOVERED') {
       col = recoveredColor;
    }
    return col;
}

var initState = function(d,i) {
  var n = {};
  n.id = i;
  n.radius = radius;
  var exposeIndex = N*N*initExposeRatio;
  if(i <= exposeIndex) {
     n.state = 'EXPOSED';
  } else {
    n.state = 'SUSCEPTIBLE';
  }
  return n;
}

function startsim() {
  svg = d3.select("#epidemic").append("svg")
    .attr({
      width: width,
      height: height
    })
  .append("g");
    //.attr("transform", "translate(70,70)");

  nodes = d3.range(N*N).map(initState);

  var point = svg.selectAll("circle")
    .data(pointGrid(nodes));
  point.enter().append("circle")
    .attr("class", "point")
    .attr("r", radius)
    .attr("id",function(d,i) {return 'individual-'+i;});

    svg.selectAll("circle").style("fill", getCircleColor);

}


distance = function(x1,y1,x2,y2) {
  return Math.sqrt( ((x2-x1)*(x2-x1)) + ((y2-y1)*(y2-y1)) );
  //return  Math.abs(x2-x1);
}

var neighborCount = 0;
var neighborSum = 0;
var degreeOfContact;

closestNeighbors = function(ind){
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

function s2ione(sNode, neighbors) {
  //console.log('Checking ' + sNode.id + " neighbors = " + neighbors);
  for(var ni=0; ni < neighbors.length; ni++) {
       var nNode = nodes[neighbors[ni]];
       if(nNode.state == 'INFECTED_ONE') {
         //console.log('Infected person ' + nNode.id + 'in contact with ' + sNode.id);
         if(Math.random() <= beta*q) {
           //console.log('EXPOSED = ' + sNode.id);
           sNode.state = 'EXPOSED';
           break;
         }
       }
  }
}

function txState(currentNodes, txRate, newState) {
  //var txCount = currentNodes.length * txRate;
  for(var e=0; e < currentNodes.length; e++) {
      if(Math.random() < txRate) {
        currentNodes[e].state = newState;
      }
  }
}

function exposed2ione(exposedNodes) {
   txState(exposedNodes, alphaOne, 'INFECTED_ONE');
}

function ione2itwo(iOneNodes) {
  txState(iOneNodes, alphaTwo, 'INFECTED_TWO');
}

function itwo2recovered(iTwoNodes) {
  txState(iTwoNodes, gamma, 'RECOVERED');
}


function simulate() {
  day++;
  if(day > MAX_DAYS) {
   clearInterval(tick);
  }


   var i=0,
   n = nodes.length;
   var exposedNodes = [];
   var iOneNodes = [];
   var iTwoNodes = [];

  for(i = 0; i<n; i++) {
    if(nodes[i].state == 'EXPOSED') {
      exposedNodes.push(nodes[i]);
    } else if(nodes[i].state == 'INFECTED_ONE') {
      iOneNodes.push(nodes[i]);
    } else if(nodes[i].state == 'INFECTED_TWO') {
      iTwoNodes.push(nodes[i]);
    } else if (nodes[i].state == 'SUSCEPTIBLE') {
      var neighbors = closestNeighbors(i);
      s2ione(nodes[i],neighbors);
    }
  }
  itwo2recovered(iTwoNodes);
  ione2itwo(iOneNodes);
  exposed2ione(exposedNodes);
  svg.selectAll("circle").style("fill", getCircleColor);


  var exposedCount = 0,
      infectedOneCount = 0,
      infectedTwoCount = 0,
      recoveredCount =0,
      sCount=0;

  for(i = 0; i<n; i++) {
    if(nodes[i].state == 'EXPOSED') {
      exposedCount++;
    } else if(nodes[i].state == 'INFECTED_ONE') {
      infectedOneCount++;
    } else if(nodes[i].state == 'INFECTED_TWO') {
      infectedTwoCount++;
    } else if (nodes[i].state == 'RECOVERED') {
      recoveredCount++;
    } else {
      sCount++;
    }
  }

  d3.select("#dayCount").text("Day: " + (day-1));
  d3.select("#population").text("Population:" + sCount);
  d3.select("#exposedCount").text("Exposed: " + exposedCount);
  d3.select("#infectedCount").text("Infected : " + (infectedOneCount+infectedTwoCount)
  + "  (I1= " + infectedOneCount + ", I2=" + infectedTwoCount +")");
  d3.select("#recoveredCount").text("Recovered:" + recoveredCount);
  d3.select("#degreeOfContact").text("Computed degreeOfContact = " + degreeOfContact);
  t += 1;
  data[0].x.push(t);
  data[0].y.push(sCount);
  data[1].x.push(t);
  data[1].y.push(exposedCount);
  data[2].x.push(t);
  data[2].y.push((infectedOneCount));
  data[3].x.push(t);
  data[3].y.push(infectedTwoCount);
  data[4].x.push(t);
  data[4].y.push(infectedOneCount+infectedTwoCount);
  data[5].x.push(t);
  data[5].y.push(recoveredCount);
  Plotly.redraw('graphDiv');

  var total = sCount + exposedCount
    + infectedOneCount +infectedTwoCount + recoveredCount;

  var row = d3.select('#tData').append('tr');
  row.append('td').text(t)
  row.append('td').text(sCount)
  row.append('td').text(exposedCount)
  row.append('td').text(infectedOneCount);
  row.append('td').text(infectedTwoCount);
  row.append('td').text(infectedOneCount+infectedTwoCount);
  row.append('td').text(recoveredCount)
  row.append('td').text(total);

  d3.select('#daytd').text(t);
  d3.select('#populationtd').text(sCount);
  d3.select('#exposedCounttd').text(exposedCount);
  d3.select('#infectedOneCounttd').text(infectedOneCount);
  d3.select('#infectedTwoCounttd').text(infectedTwoCount);
  d3.select('#infectedCounttd').text(infectedOneCount + infectedTwoCount);
  d3.select('#recoveredCounttd').text(recoveredCount);
  d3.select('#totalCounttd').text(total);
  randomMovement();

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
    circle.transition().duration(200)
        .attr("cx", cx)
        .attr("cy", cy)
        .each("end", function () {
    });

    if(nodes[i].state == 'INFECTED_ONE') {
      circle.attr("stroke-width",(distRadius - radius))
      .attr("stroke",infectedOneColor)
      .attr("stroke-opacity","0.5");
    } else {
      circle.attr("stroke-width",'0px');
    }
  }
  smallSteps = true;
}

var tick;

function simulateButtonClick() {
   startsim();
   tick = setInterval(simulate, 500);
}

function pause() {
  clearInterval(tick);
}


function refreshInput() {
  betaInput = document.getElementById("betaInput");
  betaInput.value = beta;
  betaInput.oninput = function() {
    beta = this.value;
  }

  qInput = document.getElementById("qInput");
  qInput.value = q;
  qInput.oninput = function() {
    q = this.value;
  }

  alphaOneInput = document.getElementById("alphaOneInput");
  alphaOneInput.value = alphaOne;
  alphaOneInput.oninput = function() {
    alphaOne = this.value;
  }

  alphaTwoInput = document.getElementById("alphaTwoInput");
  alphaTwoInput.value = alphaTwo;
  alphaTwoInput.oninput = function() {
    alphaTwo = this.value;
  }

  gammaInput = document.getElementById("gammaInput");
  gammaInput.value = gamma;
  gammaInput.oninput = function() {
    gamma = this.value;
  }

  daysInput = document.getElementById("daysInput");
  daysInput.value = MAX_DAYS;
  daysInput.oninput = function() {
    MAX_DAYS = this.value;
  }

  movementRatioInput = document.getElementById("movementRatioInput");
  movementRatioInput.value = movementRatio;
  movementRatioInput.oninput = function() {
    movementRatio = this.value;
  }

  spreadRadiusFactorInput = document.getElementById("spreadRadiusFactorInput");
  spreadRadiusFactorInput.value = spreadRadiusFactor;
  spreadRadiusFactorInput.oninput = function() {
    spreadRadiusFactor = this.value;
    distRadius = radius * spreadRadiusFactor;
  }

  NInput = document.getElementById("NInput");
  NInput.value = N;
  NInput.oninput = function() {
    N = this.value;
  }
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

  traceE = {
    x: [],
    y: [],
    name: 'Exposed',
    type: 'scatter',
    mode: 'lines+markers',
    marker: {
      color: exposedColor,
      size: 8
    }
  };

  traceI1 = {
    x: [],
    y: [],
    name: 'Infected-1',
    type: 'scatter',
    mode: 'lines+markers',
    marker: {
      color: infectedOneColor,
      size: 8
    }
  };

  traceI2 = {
    x: [],
    y: [],
    name: 'Infected-2',
    type: 'scatter',
    mode: 'lines+markers',
    marker: {
      color: infectedTwoColor,
      size: 8
    }
  }

  traceI = {
    x: [],
    y: [],
    name: 'Total Infected',
    type: 'scatter',
    mode: 'lines+markers',
    marker: {
      color: 'red',
      size: 8
    }
  }

  traceR = {
    x: [],
    y: [],
    name: 'Recovered',
    type: 'scatter',
    mode: 'lines+markers',
    marker: {
      color: recoveredColor,
      size: 8
    }
  };
  t = 0;
  data = [traceS, traceE, traceI1, traceI2, traceI, traceR];
  Plotly.newPlot('graphDiv', data);
}


function reset() {
  N = 32;
  beta = 0.495;
  q = 0.95;
  gamma = 1/9;
  alphaOne = 0.2;
  alphaTwo = 0.2;
  initExposeRatio = 0.002;
  day = 0;
  MAX_DAYS = 120;
  movementRatio = 30;
  spreadRadiusFactor = 15;
  radius = height/(N*2.1);
  distRadius = radius*spreadRadiusFactor/3;

  refreshInput();
  resetGraph();
  nodes = [];
  smallSteps = false;
  d3.select("svg").remove();
}

reset();
refreshInput();
Plotly.newPlot('graphDiv', data);
