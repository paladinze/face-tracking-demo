"use strict";

const CameraMode = {
    front: 'user',
    back: 'environment'
}

// Global params
const userSettings = {
    cameraMode: CameraMode.front,
    numberBees: 8
};

let THREECAMERA = null;
let GLASSESOBJ3D = null

const ACTIONS = [];
const MIXERS = [];

let ISANIMATED = false;
let BEEMESH = null, BEEOBJ3D = null;

function detect_callback(isDetected) {
    if (isDetected) {
        console.info('info: face detected');
    } else {
        console.info('info: face lost');
    }
}

function init_threeScene(spec) {
    const threeStuffs = JeelizThreeHelper.init(spec, detect_callback);

    let frameMesh = null;
    let lensesMesh = null;
    let branchesMesh = null;
    let decoMesh = null;

    const loadingManager = new THREE.LoadingManager();

    // CREATE OUR FRAME
    const loaderFrame = new THREE.BufferGeometryLoader(loadingManager);

    loaderFrame.load(
        './models/glasses/frame.json',
        (geometry) => {
            const mat = new THREE.MeshPhongMaterial({
                color: 0x000000,
                shininess: 2,
                specular: 0xffffff,
                transparent: true
            });

            frameMesh = new THREE.Mesh(geometry, mat);
            frameMesh.scale.multiplyScalar(0.0067);
            frameMesh.frustumCulled = false;
            frameMesh.renderOrder = 10000;
        }
    );

    // CREATE LENSES:
    const loaderLenses = new THREE.BufferGeometryLoader(loadingManager);

    loaderLenses.load(
        './models/glasses/lenses.json',
        (geometry) => {
            const mat = new THREE.MeshBasicMaterial({
                transparent: true,
                map: new THREE.TextureLoader().load('./models/glasses/texture_mp.jpg')
            });

            lensesMesh = new THREE.Mesh(geometry, mat);
            lensesMesh.scale.multiplyScalar(0.0067);
            lensesMesh.frustumCulled = false;
            lensesMesh.renderOrder = 10000;
        }
    );

    // CREATE GLASSES BRANCHES:
    const loaderBranches = new THREE.BufferGeometryLoader(loadingManager);

    loaderBranches.load(
        './models/glasses/branches.json',
        (geometry) => {
            const mat = new THREE.MeshBasicMaterial({
                alphaMap: new THREE.TextureLoader().load('./models/glasses/alpha_branches.jpg'),
                map: new THREE.TextureLoader().load('./models/glasses/textureBlack.jpg'),
                transparent: true
            });

            branchesMesh = new THREE.Mesh(geometry, mat);
            branchesMesh.scale.multiplyScalar(0.0067);
            branchesMesh.frustumCulled = false;
            branchesMesh.renderOrder = 10000;
        }
    );

    // CREATE DECO:
    const loaderDeco = new THREE.BufferGeometryLoader(loadingManager);

    loaderDeco.load(
        './models/glasses/deco.json',
        (geometry) => {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffffff
            });

            decoMesh = new THREE.Mesh(geometry, mat);
            decoMesh.scale.multiplyScalar(0.0067);

            decoMesh.frustumCulled = false;
            decoMesh.renderOrder = 10000;
        }
    );

    loadingManager.onLoad = () => {
        GLASSESOBJ3D.add(branchesMesh, frameMesh, lensesMesh, decoMesh);
        GLASSESOBJ3D.scale.multiplyScalar(1.1);
        GLASSESOBJ3D.position.setY(0.05); // move glasses a bit up
        GLASSESOBJ3D.position.setZ(0.25);// move glasses a bit forward

        addDragEventListener(GLASSESOBJ3D);

        threeStuffs.faceObject.add(GLASSESOBJ3D);
    };

    // ADD OUR BEES
    const beeLoader = new THREE.JSONLoader();

    beeLoader.load(
        './models/bee/bee.json',
        (geometry) => {

            const materialBee = new THREE.MeshLambertMaterial({
                map: new THREE.TextureLoader().load('./models/bee/texture_bee.jpg'),
                transparent: true,
                morphTargets: true
            });

            BEEMESH = new THREE.Mesh(geometry, materialBee);
            BEEOBJ3D = new THREE.Object3D();

            for (let i = 1; i < userSettings.numberBees; i++) {
                const sign = i % 2 === 0 ? 1 : -1;
                const beeInstance = BEEMESH.clone();

                const xRand = Math.random() * 2 - 1;
                const yRand = Math.random() * 2 - 1 + 1;
                const zRand = Math.random() * 0.5 - 0.25;

                beeInstance.position.set(xRand, yRand, zRand);
                beeInstance.scale.multiplyScalar(0.1);
                animateFlyBees(beeInstance, sign * ((i + 1) * 0.005 + 0.01), sign);
                let BEEINSTANCEOBJ3D = new THREE.Object3D();
                BEEINSTANCEOBJ3D.add(beeInstance);

                // CREATE BATTEMENT D'AILE ANIMATION
                if (!ISANIMATED) {
                    // This is where adding our animation begins
                    const mixer = new THREE.AnimationMixer(beeInstance);

                    const clips = beeInstance.geometry.animations;
                    const clip = clips[0];
                    const action = mixer.clipAction(clip);

                    ACTIONS.push(action);
                    MIXERS.push(mixer);
                }

                BEEOBJ3D.add(BEEINSTANCEOBJ3D);
            }

            // We play the animation for each butterfly and shift their cycles
            // by adding a small timeout
            ACTIONS.forEach((a, index) => {
                setTimeout(() => {
                    a.play();
                }, index*33);
            });

            ISANIMATED = true;

            threeStuffs.faceObject.add(BEEOBJ3D);
        }
    );

    // CREATE THE VIDEO BACKGROUND:
    function create_mat2d(threeTexture, isTransparent){ //MT216 : we put the creation of the video material in a func because we will also use it for the frame
        return new THREE.RawShaderMaterial({
            depthWrite: false,
            depthTest: false,
            transparent: isTransparent,
            vertexShader: "attribute vec2 position;\n\
        varying vec2 vUV;\n\
        void main(void){\n\
          gl_Position=vec4(position, 0., 1.);\n\
          vUV=0.5+0.5*position;\n\
        }",
            fragmentShader: "precision lowp float;\n\
        uniform sampler2D samplerVideo;\n\
        varying vec2 vUV;\n\
        void main(void){\n\
          gl_FragColor = texture2D(samplerVideo, vUV);\n\
        }",
            uniforms:{
                samplerVideo: { value: threeTexture }
            }
        });
    }

    // MT216 : create the frame. We reuse the geometry of the video
    const calqueMesh = new THREE.Mesh(threeStuffs.videoMesh.geometry, create_mat2d(new THREE.TextureLoader().load('./images/new_year_frame_2.png'), true))
    calqueMesh.renderOrder = 999; // render last
    calqueMesh.frustumCulled = false;
    threeStuffs.scene.add(calqueMesh);

    // CREATE THE CAMERA
    THREECAMERA = JeelizThreeHelper.create_camera();

    // CREATE LIGHTS:
    const ambient = new THREE.AmbientLight(0xffffff, 1);
    threeStuffs.scene.add(ambient)

    const dirLight = new THREE.DirectionalLight(0xffffff);
    dirLight.position.set(100, 1000, 100);
    threeStuffs.scene.add(dirLight)
} // end init_threeScene()

function animateFlyBees(mesh, theta, sign) {
    let count = 0;
    setInterval(() => {
        count += 1;
        const x = mesh.position.x;
        const z = mesh.position.z;
        const y = mesh.position.y;

        mesh.position.set(
            (x * Math.cos(theta) + z * Math.sin(theta)),
            (y * Math.cos(theta) + x * Math.sin(theta))*0.96 + 0.05,
            (z * Math.cos(theta) - x * Math.sin(theta)) //(z * Math.cos(0.03*theta) - x * Math.sin(0.03*theta)*theta)
        );
        mesh.rotation.set(-(x * Math.cos(theta) + z * Math.sin(theta))*sign, -(y * Math.cos(theta) + z * Math.sin(theta))*sign, -(z * Math.cos(theta) - x * Math.sin(theta))*sign);
        // mesh.rotation._y = Math.sin(Math.random()*2*Math.PI*100)
    }, 16)
}

function main() {
    new window.VConsole();
    GLASSESOBJ3D = new THREE.Object3D();

    document.addEventListener("WeixinJSBridgeReady", function () {
        console.log('WeixinJSBridgeReady')
        var video = document.querySelector('video')
        if (video) {
            console.log('WeixinJSBridgeReady: ', video)
            video.play();
        } else {
            setTimeout(() => {
                var video = document.querySelector('video')
                console.log('setTimeout: ', video)
                video.play();
            }, 2000)
        }

    }, false);


    JeelizResizer.size_canvas({
        canvasId: 'cameraCanvas',
        callback: function(isError, bestVideoSettings){
            init_faceFilter(bestVideoSettings);
        }
    })
}

function init_faceFilter(videoSettings){
    console.log('init_faceFilter check')
    try {
        JEELIZFACEFILTER.init({
            canvasId: 'cameraCanvas',
            NNCPath: './neuralNets/NN_LIGHT_1.json',
            videoSettings: {
                ...videoSettings,
                flipX: true,
                facingMode: userSettings.cameraMode,
            },
            followZRot: true,
            maxFacesDetected: 1,
            callbackReady: function (errCode, spec) {
                console.log('callbackReady')
                if (errCode) {
                    console.log('Error: the face filter is not ready', errCode);
                    alert('Error: the face filter is not ready')
                    alert(errCode)
                    return;
                }

                console.log('INFO: the face filter IS READY');
                init_threeScene(spec);
            },
            callbackTrack: function (detectState) {
                console.log('callbackTrack')
                JeelizThreeHelper.render(detectState, THREECAMERA);

                if (MIXERS.length > 1) {
                    MIXERS.forEach((m) => {
                        m.update(0.16);
                    })
                }
            }
        })
    } catch (e) {
        console.log(e)

    }
;
}
