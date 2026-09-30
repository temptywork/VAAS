import { access, readFile, rename, mkdir, writeFile, chmod, rm, copyFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
loadEnv({path:'.env.local',quiet:true});
// Pin the gateway so its SDP/API behavior is reproducible across installations.
const version='v1.9.14';
const assets={darwin:{arm64:'mac_arm64.zip',x64:'mac_amd64.zip'},win32:{x64:'win64.zip',arm64:'win_arm64.zip',ia32:'win32.zip'},linux:{x64:'linux_amd64',arm64:'linux_arm64'}};
const name=process.platform==='win32'?'go2rtc.exe':'go2rtc';
const toolsDirectory = path.resolve('.tools');
const destination=path.join(toolsDirectory,name),marker=path.join(toolsDirectory,'go2rtc.version');
if(process.env.GO2RTC_PATH){
  await access(process.env.GO2RTC_PATH);console.log('Using GO2RTC_PATH; bundled gateway download skipped.');process.exit(0);
}
try{
  if((await readFile(marker,'utf8')).trim()===version){await access(destination);console.log(`go2rtc ${version} is already installed.`);process.exit(0);}
}catch{}
const asset=assets[process.platform]?.[process.arch];
if(!asset)throw new Error('Unsupported platform. Download go2rtc manually and set GO2RTC_PATH.');
const response=await fetch(`https://github.com/AlexxIT/go2rtc/releases/download/${version}/go2rtc_${asset}`,{signal:AbortSignal.timeout(60000)});
if(!response.ok)throw new Error(`Gateway download failed (${response.status}).`);
await mkdir(toolsDirectory, { recursive: true });
const directory = path.join(toolsDirectory, `install-go2rtc-${randomUUID()}`);
await mkdir(directory, { mode: 0o700 });
try {
  const archive=path.join(directory,asset.endsWith('.zip')?'gateway.zip':'go2rtc');
  await writeFile(archive,Buffer.from(await response.arrayBuffer()));
  if(asset.endsWith('.zip')) {
    const command=process.platform==='win32'?'powershell.exe':'unzip';
    const args=process.platform==='win32'?['-NoProfile','-NonInteractive','-Command','Expand-Archive -LiteralPath $env:VAAS_ARCHIVE -DestinationPath $env:VAAS_EXTRACT']:['-q',archive,'-d',directory];
    const result=spawnSync(command,args,{stdio:'inherit',env:{...process.env,VAAS_ARCHIVE:archive,VAAS_EXTRACT:directory}});
    if(result.status!==0)throw new Error('Could not extract the gateway archive.');
  }
  const staged=path.join(toolsDirectory,`${name}.${process.pid}.new`);
  try{
    await copyFile(path.join(directory,name),staged);
    if(process.platform!=='win32')await chmod(staged,0o755);
    await rename(staged,destination);await writeFile(marker,version);
  }finally{await rm(staged,{force:true});}
  console.log(`Installed go2rtc ${version}. Restart the VAAS development server and select WebRTC in camera setup.`);
}finally{await rm(directory,{recursive:true,force:true});}
