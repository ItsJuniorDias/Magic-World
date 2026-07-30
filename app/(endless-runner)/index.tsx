import Text from "@/components/text";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { GLView } from "expo-gl";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";

// --- POLYFILLS ---
const noop = () => {};
if (typeof document === "undefined") {
  (global as any).document = {
    readyState: "complete",
    createElement: () => ({ style: {}, addEventListener: noop }),
    createElementNS: () => ({ style: {}, addEventListener: noop }),
    getElementsByTagName: () => [],
    addEventListener: noop,
    documentElement: {},
  } as any;
}

const randomRange = (min: number, max: number) =>
  Math.random() * (max - min) + min;

const PLANET_PALETTE = [
  { base: 0x00ffff, emissive: 0x004444 },
  { base: 0xff00ff, emissive: 0x440044 },
  { base: 0x00ff00, emissive: 0x004400 },
  { base: 0xffff00, emissive: 0x444400 },
  { base: 0xff6600, emissive: 0x442200 },
  { base: 0x6600ff, emissive: 0x220044 },
];

// ============================================================
// VISUAL UPGRADE v2 — helpers
// ============================================================

// Variantes de rocha pros meteoros (sorteadas no spawn/recycle)
const ROCK_VARIANTS = [
  { color: 0x6f6f74, roughness: 0.92, metalness: 0.08 }, // cinza rochoso
  { color: 0x7a5a42, roughness: 0.96, metalness: 0.04 }, // marrom ferroso
  { color: 0x4c4c58, roughness: 0.82, metalness: 0.22 }, // escuro azulado
  { color: 0x8a7a66, roughness: 0.9, metalness: 0.1 }, // bege empoeirado
];

// Gera textura radial suave via DataTexture (não existe canvas DOM no RN,
// então o sprite circular é desenhado pixel a pixel).
function createRadialTexture(size: number, softness: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - c) / c;
      const dy = (y - c) / c;
      const d = Math.sqrt(dx * dx + dy * dy);
      const a = Math.max(0, 1 - d);
      const alpha = Math.round(Math.pow(a, softness) * 255);
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = alpha;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

// Textura 1D de bandas pros anéis do planeta (UV remapeada pra radial)
function createRingTexture(): THREE.DataTexture {
  const w = 128;
  const data = new Uint8Array(w * 4);
  for (let x = 0; x < w; x++) {
    const t = x / (w - 1);
    // bandas: alterna densidade com ruído senoidal + fade nas bordas
    const band =
      0.55 +
      0.45 * Math.sin(t * 42.0) * Math.sin(t * 11.0 + 1.7) * Math.sin(t * 5.0);
    const edgeFade = Math.min(1, Math.min(t / 0.08, (1 - t) / 0.12));
    const alpha = Math.round(
      Math.max(0, Math.min(1, band)) * edgeFade * 200,
    );
    const i = x * 4;
    data[i] = 225;
    data[i + 1] = 205;
    data[i + 2] = 170;
    data[i + 3] = alpha;
  }
  const tex = new THREE.DataTexture(data, w, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

// Shader de atmosfera (rim glow / fresnel) — BackSide + additive
const ATMO_VERT = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;
const ATMO_FRAG = `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float fres = pow(1.0 - abs(dot(vNormal, vViewDir)), 2.2);
    gl_FragColor = vec4(uColor, fres * uIntensity);
  }
`;

// Cria a casca de atmosfera pro modelo (chamar ANTES de aplicar scale no group)
function makeAtmosphere(
  model: THREE.Object3D,
  colorHex: number,
  scaleMult = 1.22,
  intensity = 0.85,
): THREE.Mesh {
  model.updateMatrixWorld(true);
  const sphere = new THREE.Box3()
    .setFromObject(model)
    .getBoundingSphere(new THREE.Sphere());
  const geo = new THREE.SphereGeometry(sphere.radius * scaleMult, 32, 32);
  const mat = new THREE.ShaderMaterial({
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uIntensity: { value: intensity },
    },
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(sphere.center);
  (mesh as any).userData.isFxLayer = true;
  return mesh;
}

// Paletas do fogo dos motores (normal / modo warp em difficulty alta)
const FLAME_PALETTE_NORMAL = {
  core: 0xfff7d6,
  mid: 0xff7a1e,
  outer: 0xff2d00,
  light: 0xff8c3a,
};
const FLAME_PALETTE_WARP = {
  core: 0xeaffff,
  mid: 0x35d8ff,
  outer: 0x1e6bff,
  light: 0x54c8ff,
};

const DUST_COUNT = 160;

export default function FantasyRunnerEndGame() {
  const { width } = useWindowDimensions();

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [lives, setLives] = useState(3);
  const [hasShield, setHasShield] = useState(false);

  const damageOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const playerRef = useRef<THREE.Group | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);
  const moonRef = useRef<THREE.Group | null>(null);
  const phoenixRef = useRef<THREE.Group | null>(null);
  const obstaclesRef = useRef<THREE.Object3D[]>([]);
  const explosionRef = useRef<THREE.Group | null>(null);
  const heartRef = useRef<THREE.Mesh | null>(null);
  const coinRef = useRef<THREE.Mesh | null>(null);
  const shieldMeshRef = useRef<THREE.Mesh | null>(null);
  const shieldItemRef = useRef<THREE.Group | null>(null);

  // v2.1: trilha de exaustão da nave removida a pedido

  const gameActive = useRef(true);
  const speedRef = useRef(0.35);
  const panX = useRef(0);
  const scoreCounter = useRef(0);
  // (v2.2) BGM agora vem do hook useAudioPlayer — sem ref manual.
  const cameraShakeRef = useRef(0);
  const activeShield = useRef(false);

  const STAR_COUNT = 900; // camada base (havia 800)

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: loadProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [loadProgress]);

  // === ÁUDIO (v2.2 — expo-audio, substituiu expo-av) ===
  const BGM_URL =
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3";

  // Hook do expo-audio: cria o AudioPlayer e cuida do cleanup automático
  // ao desmontar. downloadFirst=true baixa o mp3 antes de tocar → menos
  // buffering em rede ruim.
  const bgmPlayer = useAudioPlayer(
    { uri: BGM_URL },
    { downloadFirst: true },
  );

  // Setup uma vez: carrega high score + configura sessão de áudio pra
  // tocar mesmo com iPhone em modo silencioso (é o motivo #1 da BGM
  // ficar muda em device físico).
  useEffect(() => {
    AsyncStorage.getItem("@high_score").then((saved) => {
      if (saved) setHighScore(Number(saved));
    });

    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    }).catch((e) =>
      console.warn("[space-runner] setAudioModeAsync falhou:", e),
    );
  }, []);

  // Configura loop e volume assim que o player existe. Propriedades
  // são idempotentes — setar antes do load completar é OK.
  useEffect(() => {
    if (!bgmPlayer) return;
    try {
      bgmPlayer.loop = true;
      bgmPlayer.volume = 0.7;
    } catch (e) {
      console.warn("[space-runner] player config falhou:", e);
    }
  }, [bgmPlayer]);

  // Play quando os assets 3D terminaram de carregar (a "tela de LOADING"
  // sai). player.play() é síncrono no expo-audio (não retorna Promise).
  useEffect(() => {
    if (isLoaded && bgmPlayer) {
      try {
        bgmPlayer.play();
      } catch (e) {
        console.warn("[space-runner] BGM play falhou:", e);
      }
    }
  }, [isLoaded, bgmPlayer]);

  const updateScore = (points: number) => {
    scoreCounter.current += points;
    setScore(scoreCounter.current);
  };

  // v2: guards pra não quebrar em atmosferas/anéis (ShaderMaterial não tem .color)
  const randomizePlanetColor = (
    planetGroup: THREE.Group | THREE.Object3D | null,
  ) => {
    if (!planetGroup) return;
    const colorPair =
      PLANET_PALETTE[Math.floor(Math.random() * PLANET_PALETTE.length)];
    planetGroup.traverse((child) => {
      if ((child as any).userData?.isFxLayer) return;
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh)
          .material as THREE.MeshStandardMaterial;
        if (!mat || !(mat as any).color) return;
        mat.color.setHex(colorPair.base);
        if ((mat as any).emissive) mat.emissive.setHex(colorPair.emissive);
      }
    });
  };

  const triggerDamageEffect = () => {
    cameraShakeRef.current = 1.5;
    damageOpacity.setValue(0.7);
    Animated.timing(damageOpacity, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  const restartGame = () => {
    scoreCounter.current = 0;
    setScore(0);
    setLives(3);
    setHasShield(false);
    activeShield.current = false;
    setIsGameOver(false);
    speedRef.current = 0.35;
    panX.current = 0;
    gameActive.current = true;
    if (playerRef.current) {
      playerRef.current.position.set(0, 1, 0);
      playerRef.current.rotation.set(0, 0, 0);
      playerRef.current.visible = true;
    }
    if (shieldMeshRef.current) shieldMeshRef.current.visible = false;
    if (explosionRef.current) {
      explosionRef.current.visible = false;
      // v2: reseta as partículas da explosão pro centro
      explosionRef.current.children.forEach((p) => p.position.set(0, 0, 0));
    }
    obstaclesRef.current.forEach((obj, i) => {
      obj.position.set(randomRange(-6, 6), 0.8, -i * 15 - 30);
      const s = randomRange(0.06, 0.12);
      obj.scale.set(
        s * randomRange(0.8, 1.2),
        s * randomRange(0.8, 1.2),
        s * randomRange(0.8, 1.2),
      );
      (obj as any).hitRadius = s * 14; // Re-calcula raio de colisão no reset
    });
    // v2.1: trilha de exaustão removida
    // Reinicia BGM do início (expo-audio: seekTo em segundos, não ms)
    if (bgmPlayer) {
      bgmPlayer
        .seekTo(0)
        .then(() => {
          try {
            bgmPlayer.play();
          } catch {}
        })
        .catch(() => {});
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        if (!isGameOver) panX.current = (gs.dx / width) * 14;
      },
    }),
  ).current;

  const onContextCreate = async (gl: any) => {
    const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;
    const renderer = new THREE.WebGLRenderer({ context: gl, antialias: true });
    renderer.setSize(w, h);
    const scene = new THREE.Scene();

    // ------------------------------------------------------------
    // v2 — DEEP SPACE: fundo roxo-profundo em vez de preto chapado
    // ------------------------------------------------------------
    const SPACE_COLOR = 0x060412;
    scene.background = new THREE.Color(SPACE_COLOR);
    scene.fog = new THREE.Fog(SPACE_COLOR, 12, 230);

    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    camera.position.set(0, 5, 12);

    // ------------------------------------------------------------
    // v2 — LUZES: key quente + fill azul frio de baixo (modelagem
    // mais rica nas rochas e na nave; antes era ambient+key só)
    // ------------------------------------------------------------
    scene.add(new THREE.AmbientLight(0xffffff, 1.05));
    const sun = new THREE.DirectionalLight(0xfff2e0, 3.6);
    sun.position.set(5, 15, 10);
    scene.add(sun);
    const coolFill = new THREE.DirectionalLight(0x4a5cff, 0.7);
    coolFill.position.set(-6, -8, 4);
    scene.add(coolFill);

    // Texturas procedurais compartilhadas
    const softDot = createRadialTexture(64, 2.2); // estrelas / poeira
    const glowDot = createRadialTexture(64, 1.15); // glows grandes / nebulosa

    // ------------------------------------------------------------
    // v2 — ESTRELAS em 3 camadas com parallax
    //   L1: fundo denso branco (mais rápidas no warp = perto)
    //   L2: coloridas médias
    //   L3: "hero stars" grandes com twinkle (2 sub-fases)
    // ------------------------------------------------------------
    type StarLayer = { points: THREE.Points; warpMult: number };
    const starLayers: StarLayer[] = [];

    const buildStarLayer = (
      count: number,
      size: number,
      warpMult: number,
      colors: number[] | null,
      opacity: number,
    ): THREE.Points => {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 400;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 400;
        pos[i * 3 + 2] = Math.random() * -600;
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

      const matParams: THREE.PointsMaterialParameters = {
        size,
        map: softDot,
        transparent: true,
        opacity,
        depthWrite: false,
        sizeAttenuation: true,
      };
      if (colors) {
        const col = new Float32Array(count * 3);
        const c = new THREE.Color();
        for (let i = 0; i < count; i++) {
          c.setHex(colors[Math.floor(Math.random() * colors.length)]);
          col[i * 3] = c.r;
          col[i * 3 + 1] = c.g;
          col[i * 3 + 2] = c.b;
        }
        geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
        matParams.vertexColors = true;
      } else {
        matParams.color = 0xffffff;
      }
      const points = new THREE.Points(geo, new THREE.PointsMaterial(matParams));
      scene.add(points);
      return points;
    };

    // L1 — base (substitui a camada única original; starsRef aponta pra ela
    // pra manter compatibilidade com o resto do código)
    const l1 = buildStarLayer(STAR_COUNT, 0.55, 1.0, null, 0.75);
    starsRef.current = l1;
    starLayers.push({ points: l1, warpMult: 1.0 });

    // L2 — coloridas
    const l2 = buildStarLayer(
      260,
      1.15,
      1.35,
      [0xffffff, 0xaaccff, 0xffeebb, 0xffc8d8, 0xc8fff4],
      0.9,
    );
    starLayers.push({ points: l2, warpMult: 1.35 });

    // L3 — hero stars com twinkle (duas metades em contrafase)
    const l3a = buildStarLayer(30, 2.4, 1.6, [0xffffff, 0xd8e8ff], 0.9);
    const l3b = buildStarLayer(30, 2.1, 1.6, [0xfff4d0, 0xffffff], 0.9);
    starLayers.push({ points: l3a, warpMult: 1.6 });
    starLayers.push({ points: l3b, warpMult: 1.6 });

    // ------------------------------------------------------------
    // v2 — NEBULOSAS: sprites gigantes coloridos ao fundo (fog off)
    // ------------------------------------------------------------
    const NEBULA_DEFS = [
      { color: 0x7a3cff, scale: 130, opacity: 0.13 },
      { color: 0x2b6bff, scale: 100, opacity: 0.12 },
      { color: 0xff3c9e, scale: 90, opacity: 0.1 },
      { color: 0x00c8b4, scale: 80, opacity: 0.09 },
      { color: 0xff7a3c, scale: 70, opacity: 0.07 },
      { color: 0x5c7aff, scale: 120, opacity: 0.11 },
    ];
    const nebulaSprites: THREE.Sprite[] = [];
    NEBULA_DEFS.forEach((def, i) => {
      const mat = new THREE.SpriteMaterial({
        map: glowDot,
        color: def.color,
        transparent: true,
        opacity: def.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      });
      const spr = new THREE.Sprite(mat);
      const sx = def.scale * randomRange(0.9, 1.3);
      // achata algumas pra parecer galáxia/nuvem alongada
      const sy = sx * (i % 2 === 0 ? randomRange(0.45, 0.7) : randomRange(0.8, 1));
      spr.scale.set(sx, sy, 1);
      spr.position.set(
        randomRange(-160, 160),
        randomRange(-40, 120),
        randomRange(-480, -260),
      );
      scene.add(spr);
      nebulaSprites.push(spr);
    });

    // v2 — SOL distante com halo (fixo, "infinitamente" longe)
    const sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowDot,
        color: 0xfff2cc,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    sunSprite.scale.set(26, 26, 1);
    sunSprite.position.set(85, 55, -420);
    scene.add(sunSprite);
    const sunHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowDot,
        color: 0xffd9a0,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    sunHalo.scale.set(85, 85, 1);
    sunHalo.position.copy(sunSprite.position);
    scene.add(sunHalo);

    // ------------------------------------------------------------
    // v2 — POEIRA DE VELOCIDADE: partículas finas próximas que
    // cruzam rápido a tela (sensação de warp muito maior)
    // ------------------------------------------------------------
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      dustPos[i * 3] = randomRange(-11, 11);
      dustPos[i * 3 + 1] = randomRange(-4, 9);
      dustPos[i * 3 + 2] = randomRange(-200, 10);
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        size: 0.07,
        map: softDot,
        color: 0xbfd4ff,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    scene.add(dust);

    const loader = new GLTFLoader();

    // v2 — refs locais das novas camadas visuais
    type FlameSet = {
      core: THREE.Mesh;
      mid: THREE.Mesh;
      outer: THREE.Mesh;
      phase: number;
    };
    const flameSets: FlameSet[] = [];
    let engineLight: THREE.PointLight | null = null;
    const asteroidTails: THREE.Mesh[] = [];

    // (v2.1) Trilha de exaustão da nave removida.

    try {
      const assetsList = [
        { id: "ship", mod: require("../../assets/models/craft_speederA.glb") },
        {
          id: "ast",
          mod: require("../../assets/models/asteroid_low_poly.glb"),
        },
        { id: "moon", mod: require("../../assets/models/moon_planet.glb") },
        {
          id: "phx",
          mod: require("../../assets/models/planet_of_phoenix.glb"),
        },
      ];

      const models: any = {};
      for (let i = 0; i < assetsList.length; i++) {
        const asset = Asset.fromModule(assetsList[i].mod);
        await asset.downloadAsync();
        const gltf = await loader.loadAsync(asset.uri!);
        models[assetsList[i].id] = gltf.scene;
        setLoadProgress((i + 1) / assetsList.length);
      }

      const shipBox = new THREE.Box3().setFromObject(models.ship);
      const shipSize = shipBox.getSize(new THREE.Vector3());
      const shipCenter = shipBox.getCenter(new THREE.Vector3());
      const shipContainer = new THREE.Group();
      models.ship.position.sub(shipCenter);
      shipContainer.add(models.ship);

      const sGeo = new THREE.IcosahedronGeometry(1.8, 1);
      const sMat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      });
      const shieldMesh = new THREE.Mesh(sGeo, sMat);
      shieldMesh.visible = false;
      shipContainer.add(shieldMesh);
      shieldMeshRef.current = shieldMesh;

      // ------------------------------------------------------------
      // v2 — FOGO DOS MOTORES em 3 camadas (núcleo quente branco →
      // laranja → envelope vermelho translúcido) + luz pontual
      // ------------------------------------------------------------
      const buildFlame = (xOffset: number, phase: number) => {
        const mk = (
          radius: number,
          height: number,
          color: number,
          opacity: number,
        ) => {
          const geo = new THREE.ConeGeometry(radius, height, 10).rotateX(
            -Math.PI / 2,
          );
          const mat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const m = new THREE.Mesh(geo, mat);
          // base do cone encostada no bocal, corpo estendendo pra +z
          m.position.set(xOffset, -0.05, shipSize.z / 2 + height * 0.32);
          shipContainer.add(m);
          return m;
        };
        const set: FlameSet = {
          core: mk(0.055, 0.55, FLAME_PALETTE_NORMAL.core, 0.95),
          mid: mk(0.1, 0.85, FLAME_PALETTE_NORMAL.mid, 0.8),
          outer: mk(0.165, 1.15, FLAME_PALETTE_NORMAL.outer, 0.4),
          phase,
        };
        flameSets.push(set);
      };
      buildFlame(-shipSize.x * 0.22, 0);
      buildFlame(shipSize.x * 0.22, Math.PI * 0.7);

      engineLight = new THREE.PointLight(
        FLAME_PALETTE_NORMAL.light,
        2.2,
        7,
        2,
      );
      engineLight.position.set(0, 0, shipSize.z / 2 + 0.6);
      shipContainer.add(engineLight);

      const pGroup = new THREE.Group();
      pGroup.add(shipContainer);
      scene.add(pGroup);
      playerRef.current = pGroup;

      // ------------------------------------------------------------
      // v2 — METEOROS com variantes de rocha + 30% "flamejantes"
      // (emissive pulsante + cauda de fogo sincronizada na cena)
      // ------------------------------------------------------------
      const applyRockVariant = (obs: THREE.Object3D) => {
        const variant =
          ROCK_VARIANTS[Math.floor(Math.random() * ROCK_VARIANTS.length)];
        const isHot = Math.random() < 0.3;
        const mat = new THREE.MeshStandardMaterial({
          color: variant.color,
          roughness: variant.roughness,
          metalness: variant.metalness,
          emissive: isHot ? 0xff3300 : 0x000000,
          emissiveIntensity: isHot ? 0.7 : 0,
        });
        obs.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).material = mat;
          }
        });
        (obs as any).mat = mat;
        (obs as any).isHot = isHot;
        (obs as any).hotPhase = Math.random() * Math.PI * 2;
      };

      for (let i = 0; i < 8; i++) {
        const obs = models.ast.clone();
        applyRockVariant(obs);

        const baseScale = randomRange(0.06, 0.12);
        obs.scale.set(
          baseScale * randomRange(0.8, 1.3),
          baseScale * randomRange(0.8, 1.3),
          baseScale * randomRange(0.8, 1.3),
        );

        obs.position.set(randomRange(-6, 6), 0.8, -i * 15 - 30);
        (obs as any).rotationSpeed = (0.04 / baseScale) * 0.01;

        // --- COLISÃO (inalterada) ---
        (obs as any).hitRadius = baseScale * 14.5;

        scene.add(obs);
        obstaclesRef.current.push(obs);

        // cauda de fogo (na cena, sincronizada no loop; só visível se isHot)
        const tailGeo = new THREE.ConeGeometry(0.5, 2.6, 8).rotateX(
          -Math.PI / 2,
        );
        const tailMat = new THREE.MeshBasicMaterial({
          color: 0xff5522,
          transparent: true,
          opacity: 0.38,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const tail = new THREE.Mesh(tailGeo, tailMat);
        tail.visible = false;
        scene.add(tail);
        asteroidTails.push(tail);
      }

      // ------------------------------------------------------------
      // v2 — PICKUPS com glow sprite (destaca no meio do caos)
      // ------------------------------------------------------------
      const addGlow = (target: THREE.Object3D, color: number, scale = 1.7) => {
        const g = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowDot,
            color,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        g.scale.set(scale, scale, 1);
        (g as any).userData.isFxLayer = true;
        target.add(g);
      };

      heartRef.current = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.4, 0),
        new THREE.MeshStandardMaterial({ color: 0xff0066, emissive: 0x660a33 }),
      );
      heartRef.current.position.set(0, 0.8, -100);
      addGlow(heartRef.current, 0xff4d94);
      scene.add(heartRef.current);

      coinRef.current = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.08, 12, 32),
        new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0x805500 }),
      );
      coinRef.current.position.set(2, 0.8, -120);
      addGlow(coinRef.current, 0xffd75e);
      scene.add(coinRef.current);

      const sItem = new THREE.Group();
      sItem.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.6, 0.6),
          new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true }),
        ),
        new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.3, 0.3),
          new THREE.MeshBasicMaterial({ color: 0x00ffff }),
        ),
      );
      sItem.position.set(randomRange(-6, 6), 0.8, -180);
      addGlow(sItem, 0x5ef2ff, 2.0);
      scene.add(sItem);
      shieldItemRef.current = sItem;

      // ------------------------------------------------------------
      // v2 — PLANETAS: atmosfera fresnel + anéis no phoenix +
      // rotação própria (aplicado ANTES do scale pro raio sair certo)
      // ------------------------------------------------------------
      models.moon.add(makeAtmosphere(models.moon, 0x6fb7ff, 1.24, 0.9));
      models.moon.scale.set(4, 4, 4);
      models.moon.position.set(-25, 12, -80);
      moonRef.current = models.moon;
      scene.add(models.moon);

      const phxAtmo = makeAtmosphere(models.phx, 0xff8a5c, 1.2, 0.75);
      models.phx.add(phxAtmo);

      // anéis
      {
        models.phx.updateMatrixWorld(true);
        const s = new THREE.Box3()
          .setFromObject(models.phx)
          .getBoundingSphere(new THREE.Sphere());
        const inner = s.radius * 1.45;
        const outer = s.radius * 2.4;
        const ringGeo = new THREE.RingGeometry(inner, outer, 96, 1);
        // remapeia UV.x pra distância radial (senão a textura de bandas não funciona)
        const rp = ringGeo.attributes.position;
        const ruv = ringGeo.attributes.uv;
        const v = new THREE.Vector3();
        for (let i = 0; i < rp.count; i++) {
          v.fromBufferAttribute(rp as THREE.BufferAttribute, i);
          const r = (v.length() - inner) / (outer - inner);
          (ruv as THREE.BufferAttribute).setXY(i, r, 0.5);
        }
        const ringMat = new THREE.MeshBasicMaterial({
          map: createRingTexture(),
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          fog: false,
          opacity: 0.85,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2.35;
        ring.rotation.y = 0.25;
        ring.position.copy(s.center);
        (ring as any).userData.isFxLayer = true;
        models.phx.add(ring);
      }

      models.phx.scale.set(5, 5, 5);
      models.phx.position.set(25, 15, -130);
      phoenixRef.current = models.phx;
      scene.add(models.phx);

      setIsLoaded(true);
    } catch (e) {
      console.error(e);
    }

    // v2 — explosão com cores/tamanhos variados (e agora ANIMA de verdade;
    // no original as partículas tinham velocity mas nunca se moviam)
    const expG = new THREE.Group();
    const EXP_COLORS = [0xff4400, 0xffaa00, 0xff2200, 0xffdd44, 0xffffff];
    for (let i = 0; i < 26; i++) {
      const sz = randomRange(0.1, 0.3);
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(sz, sz, sz),
        new THREE.MeshBasicMaterial({
          color: EXP_COLORS[i % EXP_COLORS.length],
        }),
      );
      (p as any).velocity = new THREE.Vector3(
        randomRange(-0.5, 0.5),
        randomRange(-0.5, 0.5),
        randomRange(-0.5, 0.5),
      );
      expG.add(p);
    }
    expG.visible = false;
    scene.add(expG);
    explosionRef.current = expG;

    const animate = () => {
      if (!gl) return;
      requestAnimationFrame(animate);

      const now = Date.now();

      // v2 — twinkle das hero stars roda SEMPRE (tela de game over viva)
      (l3a.material as THREE.PointsMaterial).opacity =
        0.65 + Math.sin(now * 0.004) * 0.3;
      (l3b.material as THREE.PointsMaterial).opacity =
        0.65 + Math.sin(now * 0.004 + Math.PI) * 0.3;

      if (gameActive.current && playerRef.current) {
        const difficultyFactor = 1 + (scoreCounter.current / 1000) * 0.2;
        const currentSpeed = speedRef.current * difficultyFactor;
        speedRef.current += 0.00002;

        // Warp das 3+ camadas de estrelas (parallax por warpMult)
        starLayers.forEach(({ points, warpMult }) => {
          const positions = points.geometry.attributes.position
            .array as Float32Array;
          const count = positions.length / 3;
          const warp = 14 * difficultyFactor * warpMult;
          for (let i = 0; i < count; i++) {
            positions[i * 3 + 2] += currentSpeed * warp;
            if (positions[i * 3 + 2] > 15) {
              positions[i * 3 + 2] = -600;
              positions[i * 3] = (Math.random() - 0.5) * 400;
              positions[i * 3 + 1] = (Math.random() - 0.5) * 400;
            }
          }
          points.geometry.attributes.position.needsUpdate = true;
        });

        // Poeira de velocidade (mais rápida que tudo = camada mais próxima)
        {
          const dp = dust.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < DUST_COUNT; i++) {
            dp[i * 3 + 2] += currentSpeed * 34;
            if (dp[i * 3 + 2] > 14) {
              dp[i * 3 + 2] = -200;
              dp[i * 3] = randomRange(-11, 11);
              dp[i * 3 + 1] = randomRange(-4, 9);
            }
          }
          dust.geometry.attributes.position.needsUpdate = true;
        }

        // Nebulosas: drift lento (parallax de fundo profundo)
        nebulaSprites.forEach((spr, i) => {
          spr.position.z += currentSpeed * 0.05;
          spr.position.x += Math.sin(now * 0.00006 + i) * 0.008;
          if (spr.position.z > -60) {
            spr.position.z = randomRange(-480, -320);
            spr.position.x = randomRange(-160, 160);
            spr.position.y = randomRange(-40, 120);
          }
        });

        const prevX = playerRef.current.position.x;
        playerRef.current.position.x += (panX.current - prevX) * 0.12;
        const deltaX = playerRef.current.position.x - prevX;
        playerRef.current.rotation.z = -deltaX * 2.5;
        playerRef.current.rotation.y = deltaX * 0.8;

        obstaclesRef.current.forEach((obs, idx) => {
          obs.position.z += currentSpeed;
          const rSpeed = (obs as any).rotationSpeed || 0.02;
          obs.rotation.x += rSpeed * difficultyFactor;
          obs.rotation.y += rSpeed * 0.5;

          // pulso de brasa nos meteoros flamejantes
          if ((obs as any).isHot && (obs as any).mat) {
            (obs as any).mat.emissiveIntensity =
              0.55 + Math.sin(now * 0.008 + (obs as any).hotPhase) * 0.35;
          }

          // sincroniza cauda de fogo
          const tail = asteroidTails[idx];
          if (tail) {
            tail.visible = !!(obs as any).isHot;
            if (tail.visible) {
              const hr = (obs as any).hitRadius || 1;
              tail.scale.set(hr * 0.45, hr * 0.45, hr * 1.15);
              tail.position.set(
                obs.position.x,
                obs.position.y,
                obs.position.z - hr * 1.4,
              );
              (tail.material as THREE.MeshBasicMaterial).opacity =
                0.3 + Math.sin(now * 0.012 + (obs as any).hotPhase) * 0.12;
            }
          }

          // --- COLISÃO (inalterada) ---
          const distance = playerRef.current!.position.distanceTo(obs.position);
          const collisionThreshold = (obs as any).hitRadius || 1.2;

          if (distance < collisionThreshold) {
            if (activeShield.current) {
              activeShield.current = false;
              setHasShield(false);
              if (shieldMeshRef.current) shieldMeshRef.current.visible = false;
              cameraShakeRef.current = 1.0;
            } else {
              triggerDamageEffect();
              setLives((l) => {
                if (l <= 1) {
                  gameActive.current = false;
                  playerRef.current!.visible = false;
                  explosionRef.current!.position.copy(
                    playerRef.current!.position,
                  );
                  explosionRef.current!.visible = true;
                  setIsGameOver(true);
                  if (scoreCounter.current > highScore) {
                    AsyncStorage.setItem(
                      "@high_score",
                      scoreCounter.current.toString(),
                    );
                    setHighScore(scoreCounter.current);
                  }
                  return 0;
                }
                return l - 1;
              });
            }
            obs.position.z = -120;
          }

          if (obs.position.z > 15) {
            obs.position.z = -120;
            obs.position.x = randomRange(-7, 7);
            const newBase = randomRange(0.06, 0.12);
            obs.scale.set(
              newBase * randomRange(0.8, 1.3),
              newBase * randomRange(0.8, 1.3),
              newBase * randomRange(0.8, 1.3),
            );
            (obs as any).rotationSpeed = (0.04 / newBase) * 0.01;
            (obs as any).hitRadius = newBase * 14.5;
            // v2: re-sorteia variante de rocha + estado flamejante
            const variant =
              ROCK_VARIANTS[Math.floor(Math.random() * ROCK_VARIANTS.length)];
            const isHot = Math.random() < 0.3;
            const mat = (obs as any).mat as THREE.MeshStandardMaterial;
            if (mat) {
              mat.color.setHex(variant.color);
              mat.roughness = variant.roughness;
              mat.metalness = variant.metalness;
              mat.emissive.setHex(isHot ? 0xff3300 : 0x000000);
              mat.emissiveIntensity = isHot ? 0.7 : 0;
            }
            (obs as any).isHot = isHot;
            (obs as any).hotPhase = Math.random() * Math.PI * 2;
            updateScore(10);
          }
        });

        // ITENS (lógica inalterada; glows são children e seguem junto)
        [heartRef.current, coinRef.current, shieldItemRef.current].forEach(
          (item) => {
            if (!item) return;
            item.position.z += currentSpeed;
            item.rotation.y += 0.04;
            if (playerRef.current!.position.distanceTo(item.position) < 1.4) {
              if (item === heartRef.current)
                setLives((l) => Math.min(l + 1, 3));
              if (item === coinRef.current) updateScore(250);
              if (item === shieldItemRef.current) {
                activeShield.current = true;
                setHasShield(true);
                if (shieldMeshRef.current) shieldMeshRef.current.visible = true;
              }
              item.position.z = -randomRange(150, 250);
              item.position.x = randomRange(-6, 6);
            }
            if (item.position.z > 15) {
              item.position.z = -randomRange(150, 250);
              item.position.x = randomRange(-6, 6);
            }
          },
        );

        // ------------------------------------------------------------
        // v2 — FOGO DOS MOTORES: pulso orgânico multicamada +
        // paleta warp em difficulty alta + luz acompanhando
        // ------------------------------------------------------------
        const isWarp = difficultyFactor > 2;
        const pal = isWarp ? FLAME_PALETTE_WARP : FLAME_PALETTE_NORMAL;
        flameSets.forEach((fs) => {
          const p1 = Math.sin(now * 0.031 + fs.phase);
          const p2 = Math.sin(now * 0.017 + fs.phase * 1.7);
          const pulse = 1 + p1 * 0.22 + p2 * 0.12;
          const stretch = 1.15 + difficultyFactor * 0.55;
          fs.core.scale.set(pulse, pulse, pulse * stretch * 0.9);
          fs.mid.scale.set(pulse * 1.05, pulse * 1.05, pulse * stretch);
          fs.outer.scale.set(pulse * 1.1, pulse * 1.1, pulse * stretch * 1.1);
          (fs.core.material as THREE.MeshBasicMaterial).color.setHex(pal.core);
          (fs.mid.material as THREE.MeshBasicMaterial).color.setHex(pal.mid);
          (fs.outer.material as THREE.MeshBasicMaterial).color.setHex(
            pal.outer,
          );
        });
        if (engineLight) {
          engineLight.color.setHex(pal.light);
          engineLight.intensity =
            1.9 + Math.sin(now * 0.02) * 0.5 + difficultyFactor * 0.25;
        }

        // (v2.1) Trilha de exaustão da nave removida.

        if (shieldMeshRef.current?.visible) {
          shieldMeshRef.current.rotation.y += 0.05;
          const sPulse = 1.0 + Math.sin(now * 0.01) * 0.1;
          shieldMeshRef.current.scale.set(sPulse, sPulse, sPulse);
        }

        if (moonRef.current) {
          moonRef.current.rotation.y += 0.0016; // v2: rotação própria
          moonRef.current.position.z += currentSpeed * 0.15;
          if (moonRef.current.position.z > 40) {
            moonRef.current.position.z = -140;
            randomizePlanetColor(moonRef.current);
          }
        }
        if (phoenixRef.current) {
          phoenixRef.current.rotation.y += 0.001; // v2: rotação própria
          phoenixRef.current.position.z += currentSpeed * 0.1;
          if (phoenixRef.current.position.z > 40) {
            phoenixRef.current.position.z = -180;
            randomizePlanetColor(phoenixRef.current);
          }
        }
      }

      // v2 — explosão anima quando visível (game over)
      if (explosionRef.current?.visible) {
        explosionRef.current.children.forEach((p) => {
          p.position.add((p as any).velocity);
          p.rotation.x += 0.12;
          p.rotation.y += 0.17;
        });
      }

      if (cameraShakeRef.current > 0) {
        camera.position.x = (Math.random() - 0.5) * cameraShakeRef.current;
        camera.position.y = 5 + (Math.random() - 0.5) * cameraShakeRef.current;
        cameraShakeRef.current *= 0.9;
      } else {
        camera.position.set(0, 5, 12);
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "red",
            opacity: damageOpacity,
            pointerEvents: "none",
          },
        ]}
      />

      <View style={styles.hud}>
        <Text
          title={`SCORE: ${score}`}
          fontSize={28}
          fontFamily="bold"
          style={styles.neonText}
        />
        <Text
          fontFamily="regular"
          title={`BEST: ${highScore}`}
          fontSize={18}
          color="#00ffff"
        />
        <View
          style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}
        >
          <Text
            fontFamily="regular"
            title={`${"❤️".repeat(lives)}`}
            fontSize={18}
          />
          {hasShield && (
            <View style={styles.shieldBadge}>
              <Text
                title="🛡️ GRID ACTIVE"
                fontSize={12}
                fontFamily="bold"
                style={{ color: "#00ffff" }}
              />
            </View>
          )}
        </View>
      </View>

      {isGameOver && (
        <View style={styles.overlay}>
          <Text
            title="GAME OVER"
            fontSize={40}
            fontFamily="bold"
            style={styles.gameOverText}
          />
          <TouchableOpacity style={styles.btn} onPress={restartGame}>
            <Text
              title="RETRY"
              fontSize={20}
              fontFamily="bold"
              style={{ color: "#000" }}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
            <Text
              title="BACK"
              fontSize={20}
              fontFamily="bold"
              style={{ color: "#000" }}
            />
          </TouchableOpacity>
        </View>
      )}

      {!isLoaded && (
        <View style={styles.loader}>
          <Text
            title="LOADING ..."
            fontSize={18}
            fontFamily="bold"
            style={{ color: "#00ffff", marginBottom: 20 }}
          />
          <View style={styles.progressBarContainer}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#060412" },
  hud: { position: "absolute", top: 55, left: 25, zIndex: 10 },
  neonText: {
    color: "#00ffff",
    textShadowColor: "#00ffff",
    textShadowRadius: 15,
  },
  shieldBadge: {
    marginLeft: 12,
    backgroundColor: "rgba(0, 255, 255, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: "#00ffff",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  gameOverText: {
    color: "#ff00ff",
    textShadowColor: "#ff00ff",
    textShadowRadius: 20,
  },
  btn: {
    backgroundColor: "#00ffff",
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 4,
    marginTop: 20,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#060412",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  progressBarContainer: {
    width: "70%",
    height: 4,
    backgroundColor: "rgba(0, 255, 255, 0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", backgroundColor: "#00ffff" },
});
