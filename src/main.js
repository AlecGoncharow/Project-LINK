
var renderVertexSource =
' attribute vec3 vertex;' +
' varying vec2 texCoord;' +
' void main() {' +
'   texCoord = vertex.xy * 0.5 + 0.5;' +
'   gl_Position = vec4(vertex, 1.0);' +
' }';

// fragment shader for drawing a textured quad
var renderFragmentSource =
' precision highp float;' +
' varying vec2 texCoord;' +
' uniform sampler2D texture;' +
' void main() {' +
'   gl_FragColor = texture2D(texture, texCoord);' +
' }';

// vertex shader for drawing a line
var lineVertexSource =
' attribute vec3 vertex;' +
' uniform vec3 cubeMin;' +
' uniform vec3 cubeMax;' +
' uniform mat4 modelviewProjection;' +
' void main() {' +
'   gl_Position = modelviewProjection * vec4(mix(cubeMin, cubeMax, vertex), 1.0);' +
' }';

// fragment shader for drawing a line
var lineFragmentSource =
' precision highp float;' +
' void main() {' +
'   gl_FragColor = vec4(1.0);' +
' }';

// constants for the shaders
var bounces = '2';
var epsilon = '0.0001';
var infinity = '10000.0';
var lightSize = 0.5;
var lightVal = 0.5;

// vertex shader, interpolate ray per-pixel
var tracerVertexSource =
' attribute vec3 vertex;' +
' uniform vec3 eye, ray00, ray01, ray10, ray11;' +
' varying vec3 initialRay;' +
' void main() {' +
'   vec2 percent = vertex.xy * 0.5 + 0.5;' +
'   initialRay = mix(mix(ray00, ray01, percent.y), mix(ray10, ray11, percent.y), percent.x);' +
'   gl_Position = vec4(vertex, 1.0);' +
' }';

// start of fragment shader
// handle the room cube size
var tracerFragmentSourceHeader =
' precision highp float;' +
' uniform vec3 eye;' +
' varying vec3 initialRay;' +
' uniform float textureWeight;' +
' uniform float timeSinceStart;' +
' uniform sampler2D texture;' +
' uniform float glossiness;' +
' vec3 roomCubeMin = vec3(-5.0, -1.0, -5.0);' +
' vec3 roomCubeMax = vec3(5.0, 10.0, 5.0);';

// compute the near and far intersections of the cube (stored in the x and y components) using the slab method
// no intersection means vec.x > vec.y (really tNear > tFar)
var intersectCubeSource =
' vec2 intersectCube(vec3 origin, vec3 ray, vec3 cubeMin, vec3 cubeMax) {' +
'   vec3 tMin = (cubeMin - origin) / ray;' +
'   vec3 tMax = (cubeMax - origin) / ray;' +
'   vec3 t1 = min(tMin, tMax);' +
'   vec3 t2 = max(tMin, tMax);' +
'   float tNear = max(max(t1.x, t1.y), t1.z);' +
'   float tFar = min(min(t2.x, t2.y), t2.z);' +
'   return vec2(tNear, tFar);' +
' }' +

' vec2 intersectCubeAberraion(vec3 origin, vec3 ray, vec3 cubeMin, vec3 cubeMax) {' +
'   vec3 tMin = (cubeMin - origin) / ray;' +
'   vec3 tMax = (cubeMax - origin) / ray;' +
'   vec3 t1 = min(tMin, tMax);' +
'   vec3 t2 = max(tMin, tMax);' +
'   float tNear = max(max(t1.x, t1.y), t1.z);' +
// '   if (origin.x > -0.4){ '+
'   float tFar = min(min(t2.x, t2.y), t2.z * 3.0);' +
// '   } else { '+
// '     float tFar = min(min(t2.x, t2.y), t2.z);' +
// '   } ' +
'   return vec2(tNear, tFar);' +
' }';

// given that hit is a point on the cube, what is the surface normal?
// TODO: do this with fewer branches
var normalForCubeSource =
' vec3 normalForCube(vec3 hit, vec3 cubeMin, vec3 cubeMax)' +
' {' +
'   if(hit.x < cubeMin.x + ' + epsilon + ') return vec3(-1.0, 0.0, 0.0);' +
'   else if(hit.x > cubeMax.x - ' + epsilon + ') return vec3(1.0, 0.0, 0.0);' +
'   else if(hit.y < cubeMin.y + ' + epsilon + ') return vec3(0.0, -1.0, 0.0);' +
'   else if(hit.y > cubeMax.y - ' + epsilon + ') return vec3(0.0, 1.0, 0.0);' +
'   else if(hit.z < cubeMin.z + ' + epsilon + ') return vec3(0.0, 0.0, -1.0);' +
'   else return vec3(0.0, 0.0, 1.0);' +
' }';

// use the fragment position for randomness
var randomSource =
' float random(vec3 scale, float seed) {' +
'   return fract(dot(gl_FragCoord.xyz + seed, scale) + seed);' +
' }';

// random cosine-weighted distributed vector
// from http://www.rorydriscoll.com/2009/01/07/better-sampling/
var cosineWeightedDirectionSource =
' vec3 cosineWeightedDirection(float seed, vec3 normal) {' +
'   float u = random(vec3(12.9898, 78.233, 151.7182), seed);' +
'   float v = random(vec3(63.7264, 10.873, 623.6736), seed);' +
'   float r = sqrt(u);' +
'   float angle = 6.283185307179586 * v;' +
    // compute basis from normal
'   vec3 sdir, tdir;' +
'   if (abs(normal.x)<.5) {' +
'     sdir = cross(normal, vec3(1,0,0));' +
'   } else {' +
'     sdir = cross(normal, vec3(0,1,0));' +
'   }' +
'   tdir = cross(normal, sdir);' +
'   return r*cos(angle)*sdir + r*sin(angle)*tdir + sqrt(1.-u)*normal;' +
' }';

// update ray using normal and bounce according to a diffuse reflection
var newDiffuseRay =
' ray = cosineWeightedDirection(timeSinceStart + float(bounce), normal);';

var surfaceColor =
'surfaceColor = vec3(1.0, 0.0, 1.0);'

function makeShadow(objects) {
  return '' +
' float shadow(vec3 origin, vec3 ray) {' +
    concat(objects, function(o){ return o.getShadowTestCode(); }) +
'   return 1.0;' +
' }';
}

function makeCalculateColor(objects) {
  return '' +
' vec3 calculateColor(vec3 origin, vec3 ray, vec3 light) {' +
'   vec3 colorMask = vec3(1.0);' +
'   vec3 accumulatedColor = vec3(0.0);' +

    // main raytracing loop
'   for(int bounce = 0; bounce < ' + bounces + '; bounce++) {' +
      // compute the intersection with everything
'     vec2 tRoom = intersectCube(origin, ray, roomCubeMin, roomCubeMax);' +
      concat(objects, function(o){ return o.getIntersectCode(); }) +

      // find the closest intersection
'     float t = ' + infinity + ';' +
'     if(tRoom.x < tRoom.y) t = tRoom.y;' +
      concat(objects, function(o){ return o.getMinimumIntersectCode(); }) +

      // info about hit
'     vec3 hit = origin + ray * t;' +
'     vec3 surfaceColor = vec3(0.75);' +
'     float specularHighlight = 0.0;' +
'     vec3 normal;' +

      // calculate the normal (and change wall color)
'     if(t == tRoom.y) {' +
'       normal = -normalForCube(hit, roomCubeMin, roomCubeMax);' +
        [surfaceColor][environment] +
        newDiffuseRay +
'     } else if(t == ' + infinity + ') {' +
'       break;' +
'     } else {' +
'       if(false) ;' + // hack to discard the first 'else' in 'else if'
        concat(objects, function(o){ return o.getNormalCalculationCode(); }) +
        [newDiffuseRay] +
'     }' +

      // compute diffuse lighting contribution
'     vec3 toLight = light - hit;' +
'     float diffuse = max(0.0, dot(normalize(toLight), normal));' +

      // trace a shadow ray to the light
'     float shadowIntensity = shadow(hit + normal * ' + epsilon + ', toLight);' +

      // do light bounce
'     colorMask *= surfaceColor;' +
'     accumulatedColor += colorMask * (' + lightVal + ' * diffuse * shadowIntensity);' +
'     accumulatedColor += colorMask * specularHighlight * shadowIntensity;' +

      // calculate next origin
'     origin = hit;' +
'   }' +

'   return accumulatedColor;' +
' }';
}

function makeMain() {
  return '' +
' void main() {' +
'   vec3 newLight = light + vec3(0.5) * ' + lightSize + ';' +
'   vec3 texture = texture2D(texture, gl_FragCoord.xy / 512.0).rgb;' +
'   gl_FragColor = vec4(mix(calculateColor(eye, initialRay, newLight), texture, textureWeight), 1.0);' +
' }';
}

function makeTracerFragmentSource(objects) {
  var theShader = tracerFragmentSourceHeader +
  concat(objects, function(o){ return o.getGlobalCode(); }) +
  intersectCubeSource +
  normalForCubeSource +
  randomSource +
  cosineWeightedDirectionSource +
  makeShadow(objects) +
  makeCalculateColor(objects) +
  makeMain();
  return theShader;
}






















var gl;
var ui;
var error;
var canvas;
var inputFocusCount = 0;

var angleX = 0;
var angleY = 0;
var forwardX = 0;
var forwardZ = 0;
var strafe = 0;
var yaw = 0;
var positionY = 0;
var velocityX = 0.05; // same as fraction that forward motion is computed from
var velocityY = 0.0;
var startingPositionY = 0;
var onGround = true;
var onplatform = false;
var falling = false;
var onObject;
var tempYaw = 0;
var fraction = 0.05;
var keyState = {};
var zoomZ = 4.5;
var maxjump;
var eye = Vector.create([0, 1, 0]);
var at = Vector.create([0, 0, 0]);
var light = Vector.create([0.4, 0.5, -0.6]);

var nextObjectId = 0;
var objectsList;

var MATERIAL_DIFFUSE = 0;
var MATERIAL_MIRROR = 1;
var MATERIAL_GLOSSY = 2;
var material = MATERIAL_DIFFUSE;
var glossiness = 0.6;

var STEPS1 = 0;
var RED_GREEN_CORNELL_BOX = 1;
var environment = STEPS1;

function checkJump(){
  positionY = velocityY;
  if(positionY < maxjump && onGround == false  && falling == false){
    velocityY += 0.05;
    ui.renderer.pathTracer.sampleCount = 0; //clearing the samle buffer
  }
  if(positionY > maxjump && onGround == false){
    velocityY = maxjump;
    falling = true;
    ui.renderer.pathTracer.sampleCount = 0; //clearing the samle
  }
  if(onGround == false && positionY <= maxjump && falling == true){
    for(i = 1; i < objectsList.length; i++){
      if(eye.elements[0] < objectsList[i].maxCorner.elements[0] && eye.elements[0] > objectsList[i].minCorner.elements[0]
        && eye.elements[2] < objectsList[i].maxCorner.elements[2] && eye.elements[2] > objectsList[i].minCorner.elements[2]
        && eye.elements[1] > objectsList[i].maxCorner.elements[1])
        {
          velocityY = objectsList[i].maxCorner.elements[1] + 1;
          onGround = true;
          falling = false;
          // onplatform = true;
          onObject = objectsList[i];
          return;
          // ui.renderer.pathTracer.sampleCount = 0; //clearing the samle buffer
          // document.getElementById('myAudio').play();
         }else{
          onGround = false;
          falling = true;
          velocityY -= 0.01;
          // ui.renderer.pathTracer.sampleCount = 0; //clearing the samle
        }
      }
    }

  if(onplatform == true){
    if(eye.elements[0] > onObject.maxCorner.elements[0] || eye.elements[0] < onObject.minCorner.elements[0]
      || eye.elements[2] > onObject.maxCorner.elements[2] || eye.elements[2] < onObject.minCorner.elements[2]
      || eye.elements[1] < onObject.maxCorner.elements[1] && onGround == true){
        onGround = false;
        falling = true;
        onplatform = false;
      }
  }
  if(velocityY < 0){
    velocityY = 0;
    onGround = true;
    falling = false;
    onplatform = false;
  }

}

function tick(timeSinceStart) {
  if (keyState[39] || keyState[65]){
    tempYaw += 0.05;
    yaw = tempYaw;
    ui.renderer.pathTracer.sampleCount = 0; //clearing the samle buffer
  }
  if (keyState[37] || keyState[68]){
    tempYaw -= 0.05;
    yaw = tempYaw;
    ui.renderer.pathTracer.sampleCount = 0; //clearing the samle buffer
  }
  if (keyState[38] || keyState[87]){
    forwardX += at.elements[0] * fraction; // move in forward in direction camera
    forwardZ += at.elements[2] * fraction; // move in forward in direction camera
    ui.renderer.pathTracer.sampleCount = 0; //clearing the samle buffer
  }
  if (keyState[40] || keyState[83]){
    forwardX -= at.elements[0] * fraction; // move in backwards in direction camera
    forwardZ -= at.elements[2] * fraction; // move in backwards in direction camera
    ui.renderer.pathTracer.sampleCount = 0; //clearing the samle buffer
  }
  if (keyState[32]){
    if(onGround){
      onGround = false;
      maxjump = velocityY + 2;
      ui.renderer.pathTracer.sampleCount = 0; //clearing the samle buffer
    }
  }

  eye.elements[0] = zoomZ * Math.sin(angleY) * Math.cos(angleX) + forwardX;
  eye.elements[1] = zoomZ * Math.sin(angleX) + velocityY;
  eye.elements[2] = zoomZ * Math.cos(angleY) * Math.cos(angleX) + forwardZ;

  at.elements[0] = Math.sin(yaw);
  at.elements[1] = velocityY;
  at.elements[2] = -Math.cos(yaw);

  checkJump();
  ui.updateEnvironment();
  ui.update(timeSinceStart);
  ui.render();
}

window.onload = function() {
  gl = null;
  error = document.getElementById('error');
  canvas = document.getElementById('canvas');
  try { gl = canvas.getContext('experimental-webgl'); } catch(e) {}

  if(gl) {
    ui = new UI();
    ui.setObjects(level1());
    objectsList = ui.objects;
    var start = new Date();
    error.style.zIndex = -1;
    setInterval(function(){
       tick((new Date() - start) * 0.001);
     }, 1000 / 60);
  } else {
    error.innerHTML = 'Your browser does not support WebGL.<br>Please see <a href="http://www.khronos.org/webgl/wiki/Getting_a_WebGL_Implementation">Getting a WebGL Implementation</a>.';
  }
};




////////////////////////////////////////////////////////
//////////////////MOUSE INTERACTIONS////////////////////
////////////////////////////////////////////////////////

function elementPos(element) {
  var x = 0, y = 0;
  while(element.offsetParent) {
    x += element.offsetLeft;
    y += element.offsetTop;
    element = element.offsetParent;
  }
  return { x: x, y: y };
}

function eventPos(event) {
  return {
    x: event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft,
    y: event.clientY + document.body.scrollTop + document.documentElement.scrollTop
  };
}

function canvasMousePos(event) {
  var mousePos = eventPos(event);
  var canvasPos = elementPos(canvas);
  return {
    x: mousePos.x - canvasPos.x,
    y: mousePos.y - canvasPos.y
  };
}

var mouseDown = false, oldX, oldY;

document.onmousedown = function(event) {
  var mouse = canvasMousePos(event);
  oldX = mouse.x;
  oldY = mouse.y;

  if(mouse.x >= 0 && mouse.x < 720 && mouse.y >= 0 && mouse.y < 720) {
    mouseDown = !ui.mouseDown(mouse.x, mouse.y);

    // disable selection because dragging is used for rotating the camera and moving objects
    return false;
  }

  return true;
};

document.onmousemove = function(event) {
  var mouse = canvasMousePos(event);

  if(mouseDown) {
    // update the angles based on how far we moved since last time
    angleY -= (mouse.x - oldX) * 0.01;
    angleX += (mouse.y - oldY) * 0.01;

    // don't go upside down
    angleX = Math.max(angleX, -Math.PI / 2 + 0.01);
    angleX = Math.min(angleX, Math.PI / 2 - 0.01);

    // clear the sample buffer
    ui.renderer.pathTracer.sampleCount = 0;

    // remember this coordinate
    oldX = mouse.x;
    oldY = mouse.y;
  } else {
    var canvasPos = elementPos(canvas);
    ui.mouseMove(mouse.x, mouse.y);
  }
};

document.onmouseup = function(event) {
  mouseDown = false;

  var mouse = canvasMousePos(event);
  ui.mouseUp(mouse.x, mouse.y);
};

window.addEventListener('keydown',function(e){
    keyState[e.keyCode || e.which] = true;
},true);

window.addEventListener('keyup',function(e){
    keyState[e.keyCode || e.which] = false;
},true);


document.onkeydown = function(event) {
  // if there are no <input> elements focused
  if(inputFocusCount == 0) {
    // if backspace or delete was pressed
    if(event.keyCode == 8 || event.keyCode == 46) {
      ui.deleteSelection();
      return false; // dont let it close the page
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === " ") {
        event.view.event.preventDefault();
    }
  }
};



//////////////////////////////////////////////////////
/////////////////////////HELPERS//////////////////////
//////////////////////////////////////////////////////

function getEyeRay(matrix, x, y) {
  return matrix.multiply(Vector.create([x, y, 0, 1])).divideByW().ensure3().subtract(eye);
}

function setUniforms(program, uniforms) {
  for(var name in uniforms) {
    var value = uniforms[name];
    var location = gl.getUniformLocation(program, name);
    if(location == null) continue;
    if(value instanceof Vector) {
      gl.uniform3fv(location, new Float32Array([value.elements[0], value.elements[1], value.elements[2]]));
    } else if(value instanceof Matrix) {
      gl.uniformMatrix4fv(location, false, new Float32Array(value.flatten()));
    } else {
      gl.uniform1f(location, value);
    }
  }
}

function concat(objects, func) {
  var text = '';
  for(var i = 0; i < objects.length; i++) {
    text += func(objects[i]);
  }
  return text;
}

function compileSource(source, type) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw 'compile error: ' + gl.getShaderInfoLog(shader);
  }
  return shader;
}

function compileShader(vertexSource, fragmentSource) {
  var shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, compileSource(vertexSource, gl.VERTEX_SHADER));
  gl.attachShader(shaderProgram, compileSource(fragmentSource, gl.FRAGMENT_SHADER));
  gl.linkProgram(shaderProgram);
  if(!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    throw 'link error: ' + gl.getProgramInfoLog(shaderProgram);
  }
  return shaderProgram;
}

Vector.prototype.ensure3 = function() {
  return Vector.create([this.elements[0], this.elements[1], this.elements[2]]);
};

Vector.prototype.ensure4 = function(w) {
  return Vector.create([this.elements[0], this.elements[1], this.elements[2], w]);
};

Vector.prototype.divideByW = function() {
  var w = this.elements[this.elements.length - 1];
  var newElements = [];
  for(var i = 0; i < this.elements.length; i++) {
    newElements.push(this.elements[i] / w);
  }
  return Vector.create(newElements);
};

Vector.prototype.componentDivide = function(vector) {
  if(this.elements.length != vector.elements.length) {
    return null;
  }
  var newElements = [];
  for(var i = 0; i < this.elements.length; i++) {
    newElements.push(this.elements[i] / vector.elements[i]);
  }
  return Vector.create(newElements);
};

Vector.min = function(a, b) {
  if(a.length != b.length) {
    return null;
  }
  var newElements = [];
  for(var i = 0; i < a.elements.length; i++) {
    newElements.push(Math.min(a.elements[i], b.elements[i]));
  }
  return Vector.create(newElements);
};

Vector.max = function(a, b) {
  if(a.length != b.length) {
    return null;
  }
  var newElements = [];
  for(var i = 0; i < a.elements.length; i++) {
    newElements.push(Math.max(a.elements[i], b.elements[i]));
  }
  return Vector.create(newElements);
};

Vector.prototype.minComponent = function() {
  var value = Number.MAX_VALUE;
  for(var i = 0; i < this.elements.length; i++) {
    value = Math.min(value, this.elements[i]);
  }
  return value;
};

Vector.prototype.maxComponent = function() {
  var value = -Number.MAX_VALUE;
  for(var i = 0; i < this.elements.length; i++) {
    value = Math.max(value, this.elements[i]);
  }
  return value;
};

function getintersect(origin, ray, cubeMin, cubeMax) {
  var tMin = cubeMin.subtract(origin).componentDivide(ray);
  var tMax = cubeMax.subtract(origin).componentDivide(ray);
  var t1 = Vector.min(tMin, tMax);
  var t2 = Vector.max(tMin, tMax);
  var tNear = t1.maxComponent();
  var tFar = t2.minComponent();
  if(tNear > 0 && tNear < tFar) {
    return tNear;
  }
  return Number.MAX_VALUE;
};
