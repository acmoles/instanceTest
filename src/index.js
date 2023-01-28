import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// DOM selectors
const containerEl = document.querySelector(".container");
const textInputEl = document.querySelector("#text-input");

// Settings
const fontName = "Verdana";
const textureFontSize = 25;
const fontScaleFactor = 0.18;

// We need to keep the style of editable <div> (hidden inout field) and canvas
textInputEl.style.fontSize = textureFontSize + "px";
textInputEl.style.font = "100 " + textureFontSize + "px " + fontName;
textInputEl.style.lineHeight = 1.1 * textureFontSize + "px";

// 3D scene related globals
let scene,
    camera,
    renderer,
    textCanvas,
    textCtx,
    particleGeometry,
    particleMaterial,
    instancedMesh,
    dummy,
    clock,
    birdShader,
    cursorMesh;

// String to show
let string = "It's<div>moving!</div>";

// Coordinates data per 2D canvas and 3D scene
let textureCoordinates = [];
let particles = [];
let instanceColors = [];

// Parameters of whole string per 2D canvas and 3D scene
let stringBox = {
    wTexture: 0,
    wScene: 0,
    hTexture: 0,
    hScene: 0,
    caretPosScene: []
};

// ---------------------------------------------------------------

textInputEl.innerHTML = string;
textInputEl.focus();

init();

// ---------------------------------------------------------------

function init() {
    camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 18;

    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({
        alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerEl.appendChild(renderer.domElement);

    const orbit = new OrbitControls(camera, renderer.domElement);

    textCanvas = document.createElement("canvas");
    textCanvas.width = textCanvas.height = 0;
    textCtx = textCanvas.getContext("2d");

    particleGeometry = new THREE.PlaneGeometry(0.2, 0.2);

    const loader = new THREE.TextureLoader();
    loader.load('/uvmap.jpg', (texture) => {
        particleMaterial = new THREE.MeshBasicMaterial({
            map: texture,
        });

        // test cube
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const cube = new THREE.Mesh(geometry, particleMaterial);
        scene.add(cube);

        // https://stackoverflow.com/questions/62137145/how-do-i-set-colors-for-three-js-instanced-objects
        // https://dustinpfister.github.io/2021/06/09/threejs-buffer-geometry-attributes-uv/

        var colorParsChunk = [
            'attribute vec3 instanceColor;',
            'attribute float instanceColor;',
            'varying vec3 vInstanceColor;',
            '#include <common>'
        ].join('\n');

        var instanceColorChunk = [
            '#include <begin_vertex>',
            '\tvInstanceColor = instanceColor;'
        ].join('\n');

        var fragmentParsChunk = [
            'varying vec3 vInstanceColor;',
            '#include <common>'
        ].join('\n');

        var colorChunk = [
            'vec4 diffuseColor = vec4( diffuse * vInstanceColor, opacity );'
        ].join('\n');

        particleMaterial.onBeforeCompile = function (shader) {

            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', colorParsChunk)
                .replace('#include <begin_vertex>', instanceColorChunk);

            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', fragmentParsChunk)
                .replace('vec4 diffuseColor = vec4( diffuse, opacity );', colorChunk);

        };
        //particleMaterial =
        // vec4 sampledDiffuseColor = texture2D( map, vUv );



        //     particleMaterial = new THREE.ShaderMaterial({
        //         side: THREE.DoubleSide,
        //         vertexShader: `
        //     varying vec2 vUv;

        //     void main() {
        //       vec3 transformed = vec3( position );
        //       vec4 mvPosition = vec4( transformed, 1.0 );
        //       #ifdef USE_INSTANCING
        //         mvPosition = instanceMatrix * mvPosition;
        //       #endif
        //       //vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
        //       vec4 modelViewPosition = modelViewMatrix * mvPosition;
        //       vUv = uv;
        //       gl_Position = projectionMatrix * modelViewPosition;
        //     }
        //   `,
        //         fragmentShader: `
        //     uniform float u_time;
        //     uniform float offset;
        //     uniform vec3 topColor;
        //     varying vec2 vUv;

        //     void main () {
        //       //float hue = abs(sin(u_time));
        //       // gl_FragColor = vec4(0.0,1.0,0.0,1.0); // green
        //       vec3 myColor = topColor;
        //       gl_FragColor = vec4(myColor,1.0); // red
        //       if (!gl_FrontFacing){
        //         gl_FragColor = vec4(1.0,0.95,offset,1.0); // yellow
        //       } 
        //     }
        //   `,
        //         uniforms: {
        //             u_time: { value: 0 },
        //             offset: { value: 0 },
        //             topColor: { value: new THREE.Color(0xff00ff) }
        //         }
        //     });

        dummy = new THREE.Object3D();
        clock = new THREE.Clock();

        const cursorGeometry = new THREE.BoxGeometry(0.3, 4.5, 0.03);
        cursorGeometry.translate(0.1, -2.3, 0);
        const cursorMaterial = new THREE.MeshNormalMaterial({
            transparent: true
        });
        cursorMesh = new THREE.Mesh(cursorGeometry, cursorMaterial);
        scene.add(cursorMesh);

        createEvents();
        setCaretToEndOfInput();
        handleInput();
        refreshText();
        render();
    });
}

// ---------------------------------------------------------------

function createEvents() {
    document.addEventListener("keyup", () => {
        handleInput();
        refreshText();
    });

    document.addEventListener("click", () => {
        textInputEl.focus();
        setCaretToEndOfInput();
    });
    // textInputEl.addEventListener("blur", () => {
    // textInputEl.focus();
    // });
    textInputEl.addEventListener("focus", () => {
        clock.elapsedTime = 0;
    });

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function setCaretToEndOfInput() {
    document.execCommand("selectAll", false, null);
    document.getSelection().collapseToEnd();
}

function handleInput() {
    if (isNewLine(textInputEl.firstChild)) {
        textInputEl.firstChild.remove();
    }
    if (isNewLine(textInputEl.lastChild)) {
        if (isNewLine(textInputEl.lastChild.previousSibling)) {
            textInputEl.lastChild.remove();
        }
    }

    string = textInputEl.innerHTML
        .replaceAll("<p>", "\n")
        .replaceAll("</p>", "")
        .replaceAll("<div>", "\n")
        .replaceAll("</div>", "")
        .replaceAll("<br>", "")
        .replaceAll("<br/>", "")
        .replaceAll("&nbsp;", " ");

    stringBox.wTexture = textInputEl.clientWidth;
    stringBox.wScene = stringBox.wTexture * fontScaleFactor;
    stringBox.hTexture = textInputEl.clientHeight;
    stringBox.hScene = stringBox.hTexture * fontScaleFactor;
    stringBox.caretPosScene = getCaretCoordinates().map(
        (c) => c * fontScaleFactor
    );

    function isNewLine(el) {
        if (el) {
            if (el.tagName) {
                if (
                    el.tagName.toUpperCase() === "DIV" ||
                    el.tagName.toUpperCase() === "P"
                ) {
                    if (el.innerHTML === "<br>" || el.innerHTML === "</br>") {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function getCaretCoordinates() {
        const range = window.getSelection().getRangeAt(0);
        const needsToWorkAroundNewlineBug =
            range.startContainer.nodeName.toLowerCase() === "div" &&
            range.startOffset === 0;
        if (needsToWorkAroundNewlineBug) {
            return [range.startContainer.offsetLeft, range.startContainer.offsetTop];
        } else {
            const rects = range.getClientRects();
            if (rects[0]) {
                return [rects[0].left, rects[0].top];
            } else {
                document.execCommand("selectAll", false, null);
                return [0, 0];
            }
        }
    }
}

// ---------------------------------------------------------------

function render() {
    requestAnimationFrame(render);
    updateParticlesMatrices();
    updateCursorOpacity();
    renderer.render(scene, camera);
}

// ---------------------------------------------------------------

function refreshText() {
    sampleCoordinates();

    particles = textureCoordinates.map(
        (c) => new Particle([c.x * fontScaleFactor, c.y * fontScaleFactor])
    );

    recreateInstancedMesh();
    makeTextFitScreen();
    updateCursorPosition();
}

// ---------------------------------------------------------------
// Input string to textureCoordinates

function sampleCoordinates() {
    // Draw text
    const lines = string.split(`\n`);
    const linesNumber = lines.length;
    textCanvas.width = stringBox.wTexture;
    textCanvas.height = stringBox.hTexture;
    textCtx.font = "100 " + textureFontSize + "px " + fontName;
    textCtx.fillStyle = "#2a9d8f";
    textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
    for (let i = 0; i < linesNumber; i++) {
        textCtx.fillText(
            lines[i],
            0,
            ((i + 0.8) * stringBox.hTexture) / linesNumber
        );
    }

    // Sample coordinates
    textureCoordinates = [];
    if (stringBox.wTexture > 0) {
        const imageData = textCtx.getImageData(
            0,
            0,
            textCanvas.width,
            textCanvas.height
        );
        for (let i = 0; i < textCanvas.height; i++) {
            for (let j = 0; j < textCanvas.width; j++) {
                if (imageData.data[(j + i * textCanvas.width) * 4] > 0) {
                    textureCoordinates.push({
                        x: j,
                        y: i
                    });
                }
            }
        }
    }
}

// ---------------------------------------------------------------
// Handling params of each particle

function Particle([x, y]) {
    this.x = x;
    this.y = y;
    this.z = 0;
    this.rotationX = Math.random() * 2 * Math.PI;
    this.rotationY = Math.random() * 2 * Math.PI;
    this.rotationZ = Math.random() * 2 * Math.PI;
    this.scale = 0;

    this.deltaRotation = 0.2 * (Math.random() - 0.5);
    this.deltaScale = 0.01 + 0.2 * Math.random();

    this.grow = function () {
        this.rotationX += this.deltaRotation;
        this.rotationY += this.deltaRotation;
        this.rotationZ += this.deltaRotation;

        if (this.scale < 1) {
            this.scale += this.deltaScale;
        }
    };
}

// ---------------------------------------------------------------
// Handle instances

function recreateInstancedMesh() {
    scene.remove(instancedMesh);
    instancedMesh = new THREE.InstancedMesh(
        particleGeometry,
        particleMaterial,
        particles.length
    );
    instancedMesh.frustumCulled = false;
    scene.add(instancedMesh);

    for (var i = 0; i < particles.length; i++) {
        instanceColors.push(Math.random());
        instanceColors.push(Math.random());
        instanceColors.push(Math.random());
    }

    var instanceColorsBase = new Float32Array(instanceColors.length);
    instanceColorsBase.set(instanceColors);
    particleGeometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(new Float32Array(instanceColors), 3));
    particleGeometry.setAttribute('instanceColorBase', new THREE.BufferAttribute(new Float32Array(instanceColorsBase), 3));

    instancedMesh.position.x = -0.5 * stringBox.wScene;
    instancedMesh.position.y = -0.5 * stringBox.hScene;
}

function updateParticlesMatrices() {
    let idx = 0;
    particles.forEach((p) => {
        p.grow();
        dummy.rotation.set(p.rotationX, p.rotationY, p.rotationZ);
        dummy.scale.set(p.scale, p.scale, p.scale);
        dummy.position.set(p.x, stringBox.hScene - p.y, p.z);
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(idx, dummy.matrix);
        idx++;
    });
    instancedMesh.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------
// Move camera so the text is always visible

function makeTextFitScreen() {
    const fov = camera.fov * (Math.PI / 180);
    const fovH = 2 * Math.atan(Math.tan(fov / 2) * camera.aspect);
    const dx = Math.abs((0.55 * stringBox.wScene) / Math.tan(0.5 * fovH));
    const dy = Math.abs((0.55 * stringBox.hScene) / Math.tan(0.5 * fov));
    const factor = Math.max(dx, dy) / camera.position.length();
    if (factor > 1) {
        camera.position.x *= factor;
        camera.position.y *= factor;
        camera.position.z *= factor;
    }
}

// ---------------------------------------------------------------
// Cursor related

function updateCursorPosition() {
    cursorMesh.position.x = -0.5 * stringBox.wScene + stringBox.caretPosScene[0];
    cursorMesh.position.y = 0.5 * stringBox.hScene - stringBox.caretPosScene[1];
}

function updateCursorOpacity() {
    let roundPulse = (t) =>
        Math.sign(Math.sin(t * Math.PI)) * Math.pow(Math.sin((t % 1) * 3.14), 0.2);

    if (document.hasFocus() && document.activeElement === textInputEl) {
        cursorMesh.material.opacity = roundPulse(2 * clock.getElapsedTime());
    } else {
        cursorMesh.material.opacity = 0;
    }
}
