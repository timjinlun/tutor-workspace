import { goldCoin, jarBody, jarLid, type Mesh } from "@/core/jar-mesh";
import type { Coin } from "@/core/jar-physics";

export function createJarRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) throw new Error("WebGL 2 unavailable");
  const shader = (kind: number, source: string) => {
    const s = gl.createShader(kind)!; gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const error = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(error ?? "Shader compile failed"); } return s;
  };
  const vs = shader(gl.VERTEX_SHADER, `#version 300 es
    in vec3 position; in vec3 normal;
    uniform vec3 offset; uniform float scale; uniform float tilt; uniform float yaw; uniform float height; uniform float aspect; uniform float spin; uniform float pitch;
    out vec3 n; out vec3 p;
    mat3 rx(float a){return mat3(1,0,0,0,cos(a),sin(a),0,-sin(a),cos(a));}
    mat3 ry(float a){return mat3(cos(a),0,-sin(a),0,1,0,sin(a),0,cos(a));}
    void main(){mat3 local=rx(tilt); mat3 view=rx(pitch)*ry(yaw); vec3 q=local*position*scale+offset; q.y-=height*.5;
    p=view*q; n=view*local*normal; p.xy=mat2(cos(spin),sin(spin),-sin(spin),cos(spin))*p.xy;
    gl_Position=vec4(p.x/1.40,p.y/(1.40*aspect),-p.z/10.,1.);}`);
  const fs = shader(gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float; in vec3 n; in vec3 p; uniform float glass; uniform float opacity; uniform float dark; out vec4 color;
    void main(){vec3 N=normalize(n); if(!gl_FrontFacing)N=-N;
      vec3 L=normalize(vec3(-.6,1.,1.5)); float light=max(0.,dot(N,L));
      float spec=pow(max(0.,dot(reflect(-L,N),vec3(0,0,1))),48.);
      float fres=pow(1.-abs(N.z),3.);
      if(glass>.5){color=vec4(mix(mix(vec3(.28,.40,.46),vec3(.72,.85,.92),dark),vec3(1.),light*.65+spec*.3),(.045+fres*(.45+dark*.35)+spec*.3)*opacity);}
      else{vec3 gold=mix(vec3(.34,.16,.025),vec3(1.,.73,.24),.28+.72*light); float band=pow(.5+.5*sin(N.x*9.+N.y*5.),10.); color=vec4(gold+vec3(1.,.9,.62)*(spec*.75+band*.13),opacity);}}`);
  const program = gl.createProgram()!; gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Shader link failed");
  const uniform = (name: string) => gl.getUniformLocation(program,name);
  const u = Object.fromEntries(["offset","scale","tilt","yaw","height","aspect","glass","opacity","spin","pitch","dark"].map(n=>[n,uniform(n)]));
  const upload = (mesh: Mesh) => {
    const vao=gl.createVertexArray()!; gl.bindVertexArray(vao); const buffers: WebGLBuffer[]=[];
    for(const [name,values] of [["position",mesh.positions],["normal",mesh.normals]] as const){const b=gl.createBuffer()!;buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,0,0);}
    const b=gl.createBuffer()!;buffers.push(b);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(mesh.indices),gl.STATIC_DRAW);
    return {vao,count:mesh.indices.length,dispose(){buffers.forEach(b=>gl.deleteBuffer(b));gl.deleteVertexArray(vao);}};
  };
  const coin=upload(goldCoin()); let body=upload(jarBody(4)),lid=upload(jarLid(4)),height=4,sceneHeight=300,yaw=0,pitch=.24;
  const meshDraw=(m:ReturnType<typeof upload>,x:number,y:number,z:number,size:number,tilt:number,glass:number,opacity=1)=>{
    gl.uniform3f(u.offset!,x,y,z);gl.uniform1f(u.scale!,size);gl.uniform1f(u.tilt!,tilt);gl.uniform1f(u.glass!,glass);gl.uniform1f(u.opacity!,opacity);gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0);
  };
  return {
    resize(h:number){sceneHeight=h;const next=(h-45)/56;if(next!==height){height=next;body.dispose();lid.dispose();body=upload(jarBody(height));lid=upload(jarLid(height));}},
    rotate(delta:number, vertical=0){yaw+=delta;pitch=Math.max(.08,Math.min(.65,pitch+vertical));},
    draw(coins:Coin[]){
      gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
      gl.uniform1f(u.dark!,document.documentElement.dataset.appearance === "dark" ? 1 : 0);gl.uniform1f(u.height!,height);gl.uniform1f(u.aspect!,sceneHeight/160);gl.uniform1f(u.yaw!,yaw);gl.uniform1f(u.spin!,0);gl.uniform1f(u.pitch!,pitch);
      gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(true);gl.disable(gl.CULL_FACE);
      for(const c of coins){const x=(c.x-80)/56;const z=Math.sin(c.x*7+c.y*.3)*Math.sqrt(Math.max(0,.8-x*x))*.75;
        meshDraw(coin,x,(sceneHeight-16-c.y)/56+.09,z,c.r/56,c.phase??Math.sin(c.x+c.y)*.24,0);}
      gl.depthMask(false);meshDraw(body,0,0,0,1,0,1);meshDraw(lid,0,0,0,1,0,1);gl.depthMask(true);
      canvas.dataset.renderer="webgl2";canvas.dataset.modelTriangles=String((body.count+lid.count+coin.count)/3);
    },
    dispose(){coin.dispose();body.dispose();lid.dispose();gl.deleteProgram(program);}
  };
}
