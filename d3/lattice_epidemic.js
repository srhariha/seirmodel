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
    alphaOther,
    gamma,
    initExposeRatio;

var nodes = [];

var width = 600,
    height = 600,
    N;

var day;
var MAX_DAYS;
var movementRatio;
var spreadRadiusFactor;
var infectedCompartments;

var radius;
var distRadius;

var pointGrid = d3.layout.grid()
  .points();

var svg;

/* Plotly*/
var traceS = {};
var data = [];

class Bucket {
  constructor(name, alpha, nextState, color,initRatio) {
    this.name = name;
    this.color = color;
    this.alpha = alpha;
    this.nextState = nextState;
    this.initRatio = initRatio;
  }

  setContactSpreadState(beta, q, contactSpreadState) {
    this.contactSpreadFlag = true;
    this.beta = beta;
    this.q = q;
    this.contactSpreadState = contactSpreadState;
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
  day++;
  if(day > MAX_DAYS) {
   clearInterval(tick);
  }

   var i=0,
   n = nodes.length;
   var bucketNodes = {};
   var bucketCounts = {};

   for(var j=buckets.length-1; j >= 0; j--) {
     bucketNodes[buckets[j].name] = [];
     bucketCounts[buckets[j].name] = 0;
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
  svg.selectAll("circle").style("fill", getCircleColor);
  randomMovement();
}

function updateGraph(day, sCount, bucketCounts) {
  d3.select("#degreeOfContact").text("Computed degreeOfContact = " + degreeOfContact);
  data[0].x.push(day);
  data[0].y.push(sCount);

  for(var j=0; j < buckets.length; j++) {
    data[j+1].x.push(day);
    data[j+1].y.push(bucketCounts[buckets[j].name]);
  }

  Plotly.redraw('graphDiv');
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
  if(day > 20)
   movementRatio = 0.1;

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
   randomMovement();
   tick = setInterval(simulate, 2000);
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

  infectedCompartmentsInput = document.getElementById("infectedCompartmentsInput");
  infectedCompartmentsInput.value = infectedCompartments;
  infectedCompartmentsInput.oninput = function() {
    infectedCompartments = this.value;
    initBuckets();
    refreshTables();
    resetGraph();
  }

  alphaOtherInput = document.getElementById("alphaOtherInput");
  alphaOtherInput.value = alphaOther;
  alphaOtherInput.oninput = function() {
    alphaOther = this.value;
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
  Plotly.newPlot('graphDiv', data);
}

function initBuckets() {
  buckets = [];
  buckets.push(new Bucket('EXPOSED', alphaOne, 'INFECTED_1', exposedColor,0.02));

  for(var k=1; k <= infectedCompartments; k++) {
    var nextState = 'INFECTED_' + (k+1);
    var color;
    var tx;

    if(k==infectedCompartments) {
      nextState = 'RECOVERED';
      tx = gamma;
    }

    if(k==1) {
      color = infectedOneColor;
      tx = alphaOne;
    } else if (k==2) {
      color = infectedTwoColor;
      tx = alphaTwo;
    } else {
      tx = alphaOther;
      color = "hsl(" + Math.random() * 360 + ",100%,50%)";
    }


    var i1 = new Bucket('INFECTED_' + k, tx, nextState,color);

    if(k==1) {
      i1.setContactSpreadState(beta,q,'EXPOSED');
    }

    buckets.push(i1);
  }

  buckets.push(new Bucket('RECOVERED', 0, null, recoveredColor));
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

function reset() {
  N = 20;
  beta = 0.495;
  q = 0.95;
  gamma = 1/9;
  alphaOne = 0.2;
  alphaTwo = 0.2;
  alphaOther = 0.2;
  initExposeRatio = 0.002;
  day = 0;
  MAX_DAYS = 40;
  movementRatio = 30;
  spreadRadiusFactor = 15;
  radius = height/(N*(spreadRadiusFactor/3));
  distRadius = radius*spreadRadiusFactor/3;
  infectedCompartments = 2;

  initBuckets();
  refreshTables();
  refreshInput();
  resetGraph();
  nodes = [];
  smallSteps = false;
  d3.select("svg").remove();
}

reset();
refreshInput();
Plotly.newPlot('graphDiv', data);
