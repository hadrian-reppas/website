import Delaunator from "https://cdn.skypack.dev/delaunator@5.0.0";

const MIN_FRAME_TIME = 30;
const POINT_DENSITY = 0.00002;
const MIN_VELOCITY = 1;
const MAX_VELOCITY = 2;
const SCROLL_VELOCITY_COEFF = 500;
const MAX_SCROLL_VELOCITY = 0.03;
const PADDING = 400;
const ARROW_SPEED = 0.1;

const COLOR1 = [0.5, 0.4, 0.91];
const COLOR2 = [0.2, 0, 0.78];
const COLOR3 = [0.1, 0.84, 0.51];

let canvas, width, height, points, velocities, delaunay;
let scrollPosition = 0,
  scrollVelocity = 0,
  arrowPhase = 0;
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
      const magnitude =
        (MAX_VELOCITY - MIN_VELOCITY) * Math.random() + MIN_VELOCITY;
      newVelocities[copied] = magnitude * Math.cos(angle);
      newVelocities[copied + 1] = magnitude * Math.sin(angle);
    }
  } else if (width > oldWidth) {
    for (; copied < 2 * pointCount; copied += 2) {
      newPoints[copied] =
        (width - oldWidth) * Math.random() + oldWidth + PADDING;
      newPoints[copied + 1] = paddedHeight * Math.random() - PADDING;

      const angle = 2 * Math.PI * Math.random();
      const magnitude =
        (MAX_VELOCITY - MIN_VELOCITY) * Math.random() + MIN_VELOCITY;
      newVelocities[copied] = magnitude * Math.cos(angle);
      newVelocities[copied + 1] = magnitude * Math.sin(angle);
    }
  } else {
    for (; copied < 2 * pointCount; copied += 2) {
      newPoints[copied] = paddedWidth * Math.random() - PADDING;
      newPoints[copied + 1] =
        (height - oldHeight) * Math.random() + oldHeight + PADDING;

      const angle = 2 * Math.PI * Math.random();
      const magnitude =
        (MAX_VELOCITY - MIN_VELOCITY) * Math.random() + MIN_VELOCITY;
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
    const magnitude =
      (MAX_VELOCITY - MIN_VELOCITY) * Math.random() + MIN_VELOCITY;
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

const getColor = (t) => {
  if (t < 1) {
    return [
      (1 - t) * COLOR1[0] + t * COLOR2[0],
      (1 - t) * COLOR1[1] + t * COLOR2[1],
      (1 - t) * COLOR1[2] + t * COLOR2[2],
    ];
  } else {
    const s = t - 1;
    return [
      (1 - s) * COLOR2[0] + s * COLOR3[0],
      (1 - s) * COLOR2[1] + s * COLOR3[1],
      (1 - s) * COLOR2[2] + s * COLOR3[2],
    ];
  }
};

const recomputeVertices = () => {
  const paddedWidth = width + 2 * PADDING;
  const paddedHeight = height + 2 * PADDING;
  const effectiveScrollVelocity = Math.min(
    Math.max(scrollVelocity, -MAX_SCROLL_VELOCITY),
    MAX_SCROLL_VELOCITY
  );
  for (let i = 8; i < points.length; i += 2) {
    points[i] +=
      velocities[i] * (1 + SCROLL_VELOCITY_COEFF * effectiveScrollVelocity);
    points[i + 1] +=
      velocities[i + 1] * (1 + SCROLL_VELOCITY_COEFF * effectiveScrollVelocity);
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
    const v1 = triangles[3 * i];
    const v2 = triangles[3 * i + 1];
    const v3 = triangles[3 * i + 2];
    vertices[6 * i] = points[2 * v1];
    vertices[6 * i + 1] = points[2 * v1 + 1];
    vertices[6 * i + 2] = points[2 * v2];
    vertices[6 * i + 3] = points[2 * v2 + 1];
    vertices[6 * i + 4] = points[2 * v3];
    vertices[6 * i + 5] = points[2 * v3 + 1];

    const meanX =
      (vertices[6 * i] + vertices[6 * i + 2] + vertices[6 * i + 4]) / 3;
    const meanY =
      (vertices[6 * i + 1] + vertices[6 * i + 3] + vertices[6 * i + 5]) / 3;
    const distance = (3 * meanX + meanY) / (3 * width + height);
    const clamped = Math.min(Math.max(distance, 0), 1);
    const [r, g, b] = getColor(clamped + scrollPosition);

    colors[9 * i] = r;
    colors[9 * i + 1] = g;
    colors[9 * i + 2] = b;
    colors[9 * i + 3] = r;
    colors[9 * i + 4] = g;
    colors[9 * i + 5] = b;
    colors[9 * i + 6] = r;
    colors[9 * i + 7] = g;
    colors[9 * i + 8] = b;
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

  handleScroll();
  recomputeVertices();
  drawTriangles();
  updateArrow();
};

const forceRedraw = () => {
  lastFrame = 0;
  requestRedraw(document.timeline.currentTime);
};

const updateArrow = () => {
  arrowPhase += ARROW_SPEED;
  const path = document.getElementById("arrow-path");
  const pathItems = ["M 10 -10"];
  for (let i = 1; i <= 99; i++) {
    const damping = Math.min(1, 3 - 0.03 * i);
    const x = 10 + damping * 3.5 * Math.sin(0.25 * i + arrowPhase);
    pathItems.push(`L ${x} ${i}`);
  }
  pathItems.push("M 1 91 L 10 100 L 19 91");
  path.setAttribute("d", pathItems.join(" "));
};

const handleResize = () => {
  const oldWidth = width;
  const oldHeigt = height;
  resizeCanvas();
  resizePointArray(oldWidth, oldHeigt);
  updateCornerPoints();
  forceRedraw();
};

const handleScroll = () => {
  const scrollTop = window.scrollY;
  const documentHeight =
    document.documentElement.scrollHeight - window.innerHeight;
  const newScrollPosition = scrollTop / documentHeight;
  scrollVelocity = newScrollPosition - scrollPosition;
  scrollPosition = newScrollPosition;
};

window.addEventListener("load", setup);
window.addEventListener("resize", handleResize);
