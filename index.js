import Delaunator from "https://cdn.skypack.dev/delaunator@5.0.0";

const MIN_FRAME_TIME = 50;
const POINT_DENSITY = 0.00005;
const MAX_VELOCITY = 2;
const PADDING = 400;

let canvas, width, height, points, velocities, delaunay;
let vertices = new Float32Array(0),
  colors = new Float32Array(0);
let gl, vertexBuffer, colorBuffer, aVertexPosition, aVertexColor, uResolution;

const drawTriangles = () => {
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.vertexAttribPointer(aVertexPosition, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
  gl.vertexAttribPointer(aVertexColor, 3, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);
};

const resizeCanvas = () => {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width = Math.round(window.innerWidth * ratio);
  canvas.height = height = Math.round(window.innerHeight * ratio);
  gl.viewport(0, 0, width, height);
  gl.uniform2f(uResolution, width, height);
};

const resizePointArray = (oldWidth, oldHeight) => {
  const paddedWidth = width + 2 * PADDING;
  const paddedHeight = height + 2 * PADDING;
  const oldPaddedHeight = oldHeight + 2 * PADDING;
  const area = paddedWidth * paddedHeight;
  const pointCount = Math.ceil(POINT_DENSITY * area) + 4;
  const oldPointCount = points.length / 2;

  const newPoints = new Float32Array(2 * pointCount);
  const newVelocities = new Float32Array(2 * pointCount);

  let copied = 8;
  for (let i = 8; i < 2 * oldPointCount; i += 2) {
    if (
      points[i] < -PADDING ||
      width + PADDING < points[i] ||
      points[i + 1] < -PADDING ||
      height + PADDING < points[i + 1]
    )
      continue;

    newPoints[copied] = points[i];
    newPoints[copied + 1] = points[i + 1];
    newVelocities[copied] = velocities[i];
    newVelocities[copied + 1] = velocities[i + 1];
    copied += 2;

    if (copied === 2 * pointCount) break;
  }

  if (width > oldWidth && height > oldHeight) {
    const newAreaAbove = paddedWidth * (height - oldHeight);
    const newAreaRight = (width - oldWidth) * oldPaddedHeight;
    const pAbove = newAreaAbove / (newAreaAbove + newAreaRight);
    for (; copied < 2 * pointCount; copied += 2) {
      if (Math.random() < pAbove) {
        newPoints[copied] = paddedWidth * Math.random() - PADDING;
        newPoints[copied + 1] =
          (height - oldHeight) * Math.random() + oldHeight + PADDING;
      } else {
        newPoints[copied] =
          (width - oldWidth) * Math.random() + oldWidth + PADDING;
        newPoints[copied + 1] = oldPaddedHeight * Math.random() - PADDING;
      }

      const angle = 2 * Math.PI * Math.random();
      const magnitude = MAX_VELOCITY * Math.random();
      newVelocities[copied] = magnitude * Math.cos(angle);
      newVelocities[copied + 1] = magnitude * Math.sin(angle);
    }
  } else if (width > oldWidth) {
    for (; copied < 2 * pointCount; copied += 2) {
      newPoints[copied] =
        (width - oldWidth) * Math.random() + oldWidth + PADDING;
      newPoints[copied + 1] = paddedHeight * Math.random() - PADDING;

      const angle = 2 * Math.PI * Math.random();
      const magnitude = MAX_VELOCITY * Math.random();
      newVelocities[copied] = magnitude * Math.cos(angle);
      newVelocities[copied + 1] = magnitude * Math.sin(angle);
    }
  } else {
    for (; copied < 2 * pointCount; copied += 2) {
      newPoints[copied] = paddedWidth * Math.random() - PADDING;
      newPoints[copied + 1] =
        (height - oldHeight) * Math.random() + oldHeight + PADDING;

      const angle = 2 * Math.PI * Math.random();
      const magnitude = MAX_VELOCITY * Math.random();
      newVelocities[copied] = magnitude * Math.cos(angle);
      newVelocities[copied + 1] = magnitude * Math.sin(angle);
    }
  }

  points = newPoints;
  velocities = newVelocities;
  delaunay = undefined;
};

const initializePoints = () => {
  const paddedWidth = width + 2 * PADDING;
  const paddedHeight = height + 2 * PADDING;
  const area = paddedWidth * paddedHeight;
  const pointCount = Math.ceil(POINT_DENSITY * area) + 4;

  points = new Float32Array(2 * pointCount);
  velocities = new Float32Array(2 * pointCount);

  for (let i = 8; i < 2 * pointCount; i += 2) {
    points[i] = paddedWidth * Math.random() - PADDING;
    points[i + 1] = paddedHeight * Math.random() - PADDING;
    const angle = 2 * Math.PI * Math.random();
    const magnitude = MAX_VELOCITY * Math.random();
    velocities[i] = magnitude * Math.cos(angle);
    velocities[i + 1] = magnitude * Math.sin(angle);
  }

  updateCornerPoints();
};

const updateCornerPoints = () => {
  points[0] = 0;
  points[1] = 0;

  points[2] = width + PADDING;
  points[3] = 0;

  points[4] = 0;
  points[5] = height + PADDING;

  points[6] = width + PADDING;
  points[7] = height + PADDING;
};

const recomputeVertices = () => {
  const paddedWidth = width + 2 * PADDING;
  const paddedHeight = height + 2 * PADDING;
  for (let i = 8; i < points.length; i += 2) {
    points[i] += velocities[i];
    points[i + 1] += velocities[i + 1];
    if (points[i] < -PADDING) points[i] += paddedWidth;
    else if (points[i] > width + PADDING) points[i] -= paddedWidth;
    if (points[i + 1] < -PADDING) points[i + 1] += paddedHeight;
    else if (points[i + 1] > height + PADDING) points[i + 1] -= paddedHeight;
  }

  if (delaunay) delaunay.update();
  else delaunay = new Delaunator(points);

  const triangles = delaunay.triangles;
  if (vertices.length !== 2 * triangles.length)
    vertices = new Float32Array(2 * triangles.length);
  if (colors.length !== 3 * triangles.length)
    colors = new Float32Array(3 * triangles.length);

  for (let i = 0; 3 * i < triangles.length; i++) {
    const a = triangles[3 * i];
    const b = triangles[3 * i + 1];
    const c = triangles[3 * i + 2];
    vertices[6 * i] = points[2 * a];
    vertices[6 * i + 1] = points[2 * a + 1];
    vertices[6 * i + 2] = points[2 * b];
    vertices[6 * i + 3] = points[2 * b + 1];
    vertices[6 * i + 4] = points[2 * c];
    vertices[6 * i + 5] = points[2 * c + 1];

    const midpoint =
      (vertices[6 * i] + vertices[6 * i + 2] + vertices[6 * i + 4]) / 3;
    const gray = midpoint / width;

    colors[9 * i] = gray;
    colors[9 * i + 1] = gray;
    colors[9 * i + 2] = gray;
    colors[9 * i + 3] = gray;
    colors[9 * i + 4] = gray;
    colors[9 * i + 5] = gray;
    colors[9 * i + 6] = gray;
    colors[9 * i + 7] = gray;
    colors[9 * i + 8] = gray;
  }
};

const setup = () => {
  canvas = document.getElementById("canvas");
  gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    alert("Unable to initialize WebGL. Your browser may not support it.");
    return;
  }

  const vertexShaderSource = `
    attribute vec2 aVertexPosition;
    attribute vec3 aVertexColor;
    uniform vec2 uResolution;
    varying vec3 vColor;
    void main(void) {
      vec2 zeroToOne = aVertexPosition / uResolution;
      vec2 zeroToTwo = zeroToOne * 2.0;
      vec2 clipSpace = zeroToTwo - 1.0;
      gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
      vColor = aVertexColor;
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;
    varying vec3 vColor;
    void main(void) {
      gl_FragColor = vec4(vColor, 1.0);
    }
  `;

  const compileShader = (gl, shaderSource, shaderType) => {
    var shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Error compiling shader:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const createProgram = (gl, vertexShader, fragmentShader) => {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Error linking program:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  };

  const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(
    gl,
    fragmentShaderSource,
    gl.FRAGMENT_SHADER
  );
  const shaderProgram = createProgram(gl, vertexShader, fragmentShader);
  gl.useProgram(shaderProgram);

  aVertexPosition = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  aVertexColor = gl.getAttribLocation(shaderProgram, "aVertexColor");
  uResolution = gl.getUniformLocation(shaderProgram, "uResolution");

  vertexBuffer = gl.createBuffer();
  colorBuffer = gl.createBuffer();

  gl.enableVertexAttribArray(aVertexPosition);
  gl.enableVertexAttribArray(aVertexColor);

  resizeCanvas();
  initializePoints();
  requestAnimationFrame(animationCallback);
};

const animationCallback = (timestamp) => {
  requestRedraw(timestamp);
  requestAnimationFrame(animationCallback);
};

let lastFrame = 0;
const requestRedraw = (timestamp) => {
  if (!gl) return;

  const elapsed = timestamp - lastFrame;
  if (elapsed < MIN_FRAME_TIME) return;
  lastFrame = timestamp;

  recomputeVertices();
  drawTriangles();
};

const forceRedraw = () => {
  lastFrame = 0;
  requestRedraw(document.timeline.currentTime);
};

const handleResize = () => {
  const oldWidth = width;
  const oldHeigt = height;
  resizeCanvas();
  resizePointArray(oldWidth, oldHeigt);
  updateCornerPoints();
  forceRedraw();
};

window.addEventListener("load", setup);
window.addEventListener("resize", handleResize);
window.addEventListener("scroll", () => console.log("TODO: handle scroll"));
