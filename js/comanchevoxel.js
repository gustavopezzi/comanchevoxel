var MAP_N = 30;

var CANVAS_WIDTH = 512;
var CANVAS_HEIGHT = 256;

var camera = {
    x: 512,
    y: 800,
    height: 110,
    angle: 0,
    v: -100
};

var depth = 400;

var heightMap = null; // 1024 x 1024 byte array with height information
var colorMap = null;  // 1024 x 1024 byte array with color indices
var palette = null;   // corresponding colors to the color indices

var context = null;
var imageData = null;

var bufArray = null; // color data
var buf8 = null;     // the same array but with bytes
var buf32 = null;    // the same array but with 32bit words

var kForward = false;
var kBackward = false;
var kLeft = false;
var kRight = false;
var kUp = false;
var kDown = false;
var kLookUp = false;
var kLookDown = false;

var isUpdateRunning = false;
var kPressed = false;

function updateCamera() {
    kPressed = false;
    if (kLeft) {
        camera.angle += 0.05;
        kPressed = true;
    }
    if (kRight) {
        camera.angle -= 0.05;
        kPressed = true;
    }
    if (kForward) {
        camera.x -= 3. * Math.sin(camera.angle);
        camera.y -= 3. * Math.cos(camera.angle);
        kPressed = true;
    }
    if (kBackward) {
        camera.x += 3. * Math.sin(camera.angle);
        camera.y += 3. * Math.cos(camera.angle);
        kPressed = true;
    }
    if (kUp) {
        camera.height += 2;
        kPressed = true;
    }
    if (kDown) {
        camera.height -= 2;
        kPressed = true;
    }
    if (kLookUp) {
        camera.v += 2;
        kPressed = true;
    }
    if (kLookDown) {
        camera.v -= 2;
        kPressed = true;
    }
}

function drawHud() {
    context.lineWidth = 1;
    context.strokeStyle = '#00FF00';

    // draw target cross
    context.beginPath();
    context.moveTo(CANVAS_WIDTH/2 - 5, CANVAS_HEIGHT/2);
    context.lineTo(CANVAS_WIDTH/2 + 5, CANVAS_HEIGHT/2);
    context.stroke();
    context.beginPath();
    context.moveTo(CANVAS_WIDTH/2, CANVAS_HEIGHT/2 - 5);
    context.lineTo(CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 5);
    context.stroke();

    // draw bottom border
    context.beginPath();
    context.lineWidth = 2;
    context.strokeStyle = '#4A5B89';
    context.moveTo(0, CANVAS_HEIGHT);
    context.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
    context.stroke();
}

function updateCanvas() {
    isUpdateRunning = true;

    updateCamera();

    var size = imageData.width * imageData.height;

    // fill background color
    var col = 0xCCFFA0A0;
    for (var i = 0; i < buf32.length; i++) {
        buf32[i] = col | 0;
    }

    var sinAngle = Math.sin(camera.angle);
    var cosAngle = Math.cos(camera.angle);

    for (var i = 0; i < imageData.width; i++) {
        // for one column calculate the end position of the ray in relative coordinates
        var x3d = (i - imageData.width / 2) * 1.5 * 1.5;
        var y3d = -depth * 1.5;

        // rotate the position
        var rotX =  cosAngle * x3d + sinAngle * y3d;
        var rotY = -sinAngle * x3d + cosAngle * y3d;

        rayCast(i | 0, camera.x, camera.y, rotX + camera.x, rotY + camera.y, y3d / Math.sqrt(x3d * x3d + y3d * y3d));
    }

    // the image rendered now show it on screen
    imageData.data.set(buf8);

    context.putImageData(imageData, 0, 0);

    // draw hud
    drawHud();

    if (!kPressed) {
        isUpdateRunning = false;
        return;
    }

    window.setTimeout(updateCanvas, 0);
}

function rayCast(line, x1, y1, x2, y2, d) {
    // line parameter is the vertical line to render
    var hMap = heightMap;
    var cMap = colorMap;
    var palMap = palette;
    var image = imageData;

    // x1, y1, x2, y2 are the start and end points on map for ray
    var dx = x2 - x1;
    var dy = y2 - y1;

    // distance between start and end point
    var r = Math.floor(Math.sqrt(dx * dx + dy * dy)) | 0;

    // calculate stepsize in x and y direction
    dx = dx / r;
    dy = dy / r;

    // used for occlusion
    var ymin = 256;

    // we draw from the front to the back
    for (var i = 1; i < r | 0; i++) {
        x1 += dx;
        y1 += dy;

        // get offset on the map considering periodic boundary conditions and & since the size of the map is power of two
        var mapOffset = ((Math.floor(y1) & 1023) << 10) + (Math.floor(x1) & 1023) | 0;

        // get height and color
        var h = camera.height - hMap[mapOffset | 0];

        // perspective calculation where d is the correction parameter
        var y3 = Math.abs(d) * i;
        var z3 = Math.floor(h / y3 * 100 - camera.v)|0;

        // draw vertical line
        if (z3 < 0) {
            z3 = 0;
        }

        if (z3 < imageData.height - 1) {
            // get offset on screen for the vertical line
            var offset = (((z3|0) * image.width) + line) | 0;

            // old vga mode used a palette for the colors
            var col = palette[cMap[mapOffset|0]|0]|0;

            for (var k = z3 | 0; k < ymin | 0; k++) {
                buf32[offset|0] = col | 0;
                offset = offset + image.width | 0;
            }
        }

        if (ymin > z3) {
            ymin = z3 | 0;
        }
    }
}

function detectKeysDown(e) {
    switch(e.keyCode) {
        case 37: kLeft     = true; break; // left
        case 39: kRight    = true; break; // right
        case 38: kForward  = true; break; // up
        case 40: kBackward = true; break; // down
        case 69: kUp       = true; break; // e
        case 68: kDown     = true; break; // d
        case 87: kLookUp   = true; break; // w
        case 83: kLookDown = true; break; // s
        default: return; break;
    }

    if (!isUpdateRunning) {
        updateCanvas();
    }

    return false;
}

function detectKeysUp(e) {
    switch(e.keyCode) {
        case 37: kLeft     = false; break; // left
        case 39: kRight    = false; break; // right
        case 38: kForward  = false; break; // up
        case 40: kBackward = false; break; // down
        case 69: kUp       = false; break; // e
        case 68: kDown     = false; break; // d
        case 87: kLookUp   = false; break; // w
        case 83: kLookDown = false; break; // s
        default: return; break;
    }
    return false;
}

function loadBinaryResource(url, type) {
    var req = new XMLHttpRequest();
    req.open('GET', url, true);
    req.responseType = "arraybuffer";
    req.onload = function (e) {
        var arrayBuffer = req.response;
        if (arrayBuffer) {
            if (type == 1) {
                heightMap = new Uint8Array(arrayBuffer);
            }
            if (type == 2) {
                colorMap = new Uint8Array(arrayBuffer);
            }
            if (type == 3) {
                palMap = new Uint8Array(arrayBuffer);
                // old vga mode used a palette for the colors
                for (var i = 0; i < 256; i++) {
                    palette[i] = 0xFF000000 | ((palMap[i * 3 + 2]) << 16) | ((palMap[i * 3 + 1]) << 8) | (palMap[i * 3 + 0]);
                }
            }
            if (!isUpdateRunning) {
                updateCanvas();
            }
        }
    }
    req.send(null);
}

function loadMap(index) {
    index = (index == undefined) ? Math.floor(Math.random() * MAP_N) : index;
    loadBinaryResource('map/map' + index + '.palette', 3);
    loadBinaryResource('map/map' + index + '.height', 1);
    loadBinaryResource('map/map' + index + '.color', 2);
    document.getElementById('map-thumb').src = 'thumbs/map' + index + '.png';
}

function init() {
    heightMap = new Uint8Array(1024 * 1024);
    colorMap  = new Uint8Array(1024 * 1024);
    palette   = new Uint32Array(256);

    loadMap(0);

    var canvas = document.getElementById('canvas-terrain');

    if (canvas.getContext) {
        context = canvas.getContext('2d');
        imageData = context.createImageData(canvas.width, canvas.height);
    }

    bufArray = new ArrayBuffer(imageData.width*imageData.height*4);
    buf8 = new Uint8Array(bufArray);
    buf32 = new Uint32Array(bufArray);

    document.onkeydown = detectKeysDown;
    document.onkeyup = detectKeysUp;

    updateCanvas();
}

document.addEventListener("DOMContentLoaded", function(event) {
    init();
});