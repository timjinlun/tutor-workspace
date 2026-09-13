import { goldCoin, type Mesh, type Quaternion } from "@/core/jar-mesh";
import type { PhysicsCoinPose } from "@/core/jar-physics-3d";
import type { Coin } from "@/core/jar-physics";

export function createJarRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) throw new Error("WebGL 2 unavailable");
  const shader = (kind: number, source: string) => {
    const result = gl.createShader(kind)!;
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(result);
      gl.deleteShader(result);
      throw new Error(error ?? "Shader compile failed");
    }
    return result;
  };
  const vertex = shader(gl.VERTEX_SHADER, `#version 300 es
    in vec3 position; in vec3 normal;
    uniform vec3 offset; uniform vec3 objectScale; uniform vec4 objectRotation;
    uniform float cameraYaw; uniform float cameraPitch; uniform float height; uniform float aspect;
    out vec3 n; out vec3 p;
    mat3 rx(float a){return mat3(1,0,0,0,cos(a),sin(a),0,-sin(a),cos(a));}
    mat3 ry(float a){return mat3(cos(a),0,-sin(a),0,1,0,sin(a),0,cos(a));}
    mat3 quaternion(vec4 q){
      float x=q.x,y=q.y,z=q.z,w=q.w;
      return mat3(
        1.-2.*(y*y+z*z), 2.*(x*y+z*w), 2.*(x*z-y*w),
        2.*(x*y-z*w), 1.-2.*(x*x+z*z), 2.*(y*z+x*w),
        2.*(x*z+y*w), 2.*(y*z-x*w), 1.-2.*(x*x+y*y));
    }
    void main(){
      mat3 object=quaternion(objectRotation); mat3 view=rx(cameraPitch)*ry(cameraYaw);
      vec3 q=object*(position*objectScale)+offset; q.y-=height*.5;
      p=view*q; n=view*object*normalize(normal/objectScale);
      gl_Position=vec4(p.x/1.40,p.y/(1.40*aspect),-p.z/10.,1.);
    }`);
  const fragment = shader(gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float; in vec3 n; in vec3 p; uniform float glass; uniform float opacity; uniform float dark; out vec4 color;
    void main(){vec3 N=normalize(n); if(!gl_FrontFacing)N=-N;
      vec3 L=normalize(vec3(-.6,1.,1.5)); float light=max(0.,dot(N,L));
      float spec=pow(max(0.,dot(reflect(-L,N),vec3(0,0,1))),48.);
      float fres=pow(1.-abs(N.z),3.);
      if(glass>.5){color=vec4(mix(mix(vec3(.28,.40,.46),vec3(.72,.85,.92),dark),vec3(1.),light*.65+spec*.3),(.045+fres*(.45+dark*.35)+spec*.3)*opacity);}
      else{vec3 gold=mix(vec3(.34,.16,.025),vec3(1.,.73,.24),.28+.72*light); float band=pow(.5+.5*sin(N.x*9.+N.y*5.),10.); color=vec4(gold+vec3(1.,.9,.62)*(spec*.75+band*.13),opacity);}}`);
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Shader link failed");
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const u = Object.fromEntries([
    "offset", "objectScale", "objectRotation", "cameraYaw", "cameraPitch", "height", "aspect", "glass", "opacity", "dark",
  ].map((name) => [name, uniform(name)]));
  const upload = (mesh: Mesh) => {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buffers: WebGLBuffer[] = [];
    for (const [name, values] of [["position", mesh.positions], ["normal", mesh.normals]] as const) {
      const buffer = gl.createBuffer()!;
      buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
      const attribute = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 0, 0);
    }
    const indexBuffer = gl.createBuffer()!;
    buffers.push(indexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
    return {
      vao,
      count: mesh.indices.length,
      dispose() {
        buffers.forEach((buffer) => gl.deleteBuffer(buffer));
        gl.deleteVertexArray(vao);
      },
    };
  };
  const coin = upload(goldCoin());
  let height = 4;
  let sceneHeight = 300;
  const cameraYaw = 0;
  const cameraPitch = 0.24;
  const meshDraw = (
    mesh: ReturnType<typeof upload>,
    position: { x: number; y: number; z: number },
    scale: { x: number; y: number; z: number },
    rotation: Quaternion,
    glass: number,
    opacity = 1,
  ) => {
    gl.uniform3f(u.offset!, position.x, position.y, position.z);
    gl.uniform3f(u.objectScale!, scale.x, scale.y, scale.z);
    gl.uniform4f(u.objectRotation!, rotation.x, rotation.y, rotation.z, rotation.w);
    gl.uniform1f(u.glass!, glass);
    gl.uniform1f(u.opacity!, opacity);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  };
  const begin = () => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform1f(u.dark!, document.documentElement.dataset.appearance === "dark" ? 1 : 0);
    gl.uniform1f(u.height!, height);
    gl.uniform1f(u.aspect!, sceneHeight / 160);
    gl.uniform1f(u.cameraYaw!, cameraYaw);
    gl.uniform1f(u.cameraPitch!, cameraPitch);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
  };
  const finish = () => {
    canvas.dataset.renderer = "webgl2";
    canvas.dataset.modelTriangles = String(coin.count / 3);
  };
  return {
    resize(nextSceneHeight: number) {
      sceneHeight = nextSceneHeight;
      height = (nextSceneHeight - 45) / 56;
    },
    draw(coins: Coin[]) {
      begin();
      gl.depthMask(true);
      for (const item of coins) {
        const tilt = item.phase ?? Math.sin(item.x + item.y) * 0.24;
        const rotation = { x: Math.sin(tilt / 2), y: 0, z: 0, w: Math.cos(tilt / 2) };
        const radius = item.r / 56;
        meshDraw(
          coin,
          { x: (item.x - 80) / 56, y: (sceneHeight - 16 - item.y) / 56 + 0.09, z: Math.sin(item.x * 7 + item.y * 0.3) * 0.42 },
          { x: radius, y: radius, z: radius },
          rotation,
          0,
        );
      }
      finish();
    },
    drawRigid(coins: PhysicsCoinPose[]) {
      begin();
      gl.depthMask(true);
      for (const item of coins) {
        meshDraw(
          coin,
          item.position,
          { x: item.radius, y: item.halfHeight / 0.17, z: item.radius },
          item.rotation,
          0,
        );
      }
      finish();
    },
    dispose() {
      coin.dispose();
      gl.deleteProgram(program);
    },
  };
}
