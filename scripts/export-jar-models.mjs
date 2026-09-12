import { jarBody, jarLid, goldCoin } from '../src/core/jar-mesh.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
const folder = new URL('../docs/models/', import.meta.url);
mkdirSync(folder, { recursive: true });
function exportModel(name, meshes, glass) {
  const chunks = [], views = [], accessors = []; let length = 0;
  const attribute = (values, index = false) => {
    const array = index ? new Uint16Array(values) : new Float32Array(values);
    const bytes = Buffer.from(array.buffer);
    const view = views.length; views.push({buffer:0,byteOffset:length,byteLength:bytes.length});
    chunks.push(bytes); length += bytes.length;
    const padding = (4-length%4)%4; chunks.push(Buffer.alloc(padding));length+=padding;
    const accessor = {bufferView:view,componentType:index?5123:5126,count:values.length/(index?1:3),type:index?'SCALAR':'VEC3'};
    if(!index){accessor.min=[0,1,2].map(axis=>Math.min(...values.filter((_,i)=>i%3===axis)));accessor.max=[0,1,2].map(axis=>Math.max(...values.filter((_,i)=>i%3===axis)));}
    accessors.push(accessor);return accessors.length-1;
  };
  const primitives = meshes.map(mesh=>({attributes:{POSITION:attribute(mesh.positions),NORMAL:attribute(mesh.normals)},indices:attribute(mesh.indices,true),material:0}));
  const material = glass ? {name:'Clear acrylic',doubleSided:true,alphaMode:'BLEND',pbrMetallicRoughness:{baseColorFactor:[.78,.9,.94,.18],metallicFactor:0,roughnessFactor:.12}} : {name:'Brushed gold',pbrMetallicRoughness:{baseColorFactor:[1,.67,.18,1],metallicFactor:1,roughnessFactor:.27}};
  const document = {asset:{version:'2.0',generator:'记一课 procedural mesh exporter'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name}],meshes:[{primitives}],materials:[material],buffers:[{byteLength:length}],bufferViews:views,accessors};
  const raw=Buffer.from(JSON.stringify(document));const json=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]);const bin=Buffer.concat(chunks);
  const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);
  const jh=Buffer.alloc(8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
  writeFileSync(new URL(name+'.glb',folder),Buffer.concat([header,jh,json,bh,bin]));
}
exportModel('savings-jar',[jarBody(4.8),jarLid(4.8)],true);
exportModel('gold-coin',[goldCoin()],false);
console.log('Exported savings-jar.glb and gold-coin.glb');
