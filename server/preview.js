import fs from 'node:fs';
import path from 'node:path';
import { id,now,text,fail } from './domain.js';
import { transaction } from './db.js';
import { hashPassword,randomToken } from './security.js';
import { imageMime,insertFile,removeFiles,checkStorageQuota } from './files.js';

// Explicit maintenance operation only: this is never called by app startup or an API.
export async function seedOriginalPreview(db,ownerId,fixture,config,legacyUploadsDir) {
  if(config.production)fail(400,'Preview data is only supported in a local development database.');
  if(!db.prepare('SELECT 1 FROM users WHERE id=?').get(ownerId))fail(400,'Create the requested owner account first.');
  if(!fixture.version || !Array.isArray(fixture.legacy?.projects) || !Array.isArray(fixture.legacy?.works) ||
    !Array.isArray(fixture.tasks) || !Array.isArray(fixture.board?.rows) || !Array.isArray(fixture.reports) ||
    !Array.isArray(fixture.assigneeNames))fail(400,'Invalid original preview fixture.');
  db.exec(`CREATE TABLE IF NOT EXISTS original_preview_imports(
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_version TEXT NOT NULL,summary TEXT NOT NULL,PRIMARY KEY(owner_id,source_version));`);
  const previous=()=>db.prepare('SELECT summary FROM original_preview_imports WHERE owner_id=? AND source_version=?').get(ownerId,fixture.version);
  if(previous())return {...JSON.parse(previous().summary),alreadyImported:true};
  const actorNames=[...new Set([...fixture.assigneeNames,...fixture.reports.map(report=>report.author)])];
  const hashes=await Promise.all(actorNames.map(()=>hashPassword(randomToken())));
  const addedFiles=[];
  fs.mkdirSync(config.uploadsDir,{recursive:true,mode:0o700});
  try {
    return transaction(db,()=>{
      if(previous())return {...JSON.parse(previous().summary),alreadyImported:true};
      const date=now(),result={projects:0,works:0,reports:0,files:0,samplePeople:actorNames.length,warnings:[]};
      const actors=new Map(actorNames.map((name,index)=>{
        const actorId=id();
        // Random, undisclosed passwords: these names represent sample data, not real login accounts.
        db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(actorId,text(name,'Sample name',100),
          'preview_'+id().replaceAll('-',''),null,hashes[index],date);
        return [name,actorId];
      }));
      const paths=new Map(),roots=new Set(),legacyProjects=new Map();
      const addProject=(name,parent,parts)=>{
        const projectId=id(),rootId=parent?.root_id || projectId;
        const project={id:projectId,name:text(name,'Project name'),parent_id:parent?.id || null,root_id:rootId,owner_id:ownerId};
        db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run(projectId,project.name,project.parent_id,rootId,ownerId,date);
        paths.set(JSON.stringify(parts),project);roots.add(rootId);result.projects+=1;
        return project;
      };
      const pathParts=new Map(),remaining=new Map(fixture.legacy.projects.map(project=>[String(project.id),project]));
      if(remaining.size!==fixture.legacy.projects.length)fail(400,'Duplicate legacy project IDs.');
      while(remaining.size) {
        let progress=false;
        for(const [key,source] of remaining) {
          const parentKey=source.parentId==null ? null : String(source.parentId),parent=legacyProjects.get(parentKey);
          if(parentKey && !parent)continue;
          const parts=[...(pathParts.get(parentKey) || []),source.name];
          if(parts.length>12)fail(400,'Legacy project hierarchy is too deep.');
          legacyProjects.set(key,addProject(source.name,parent,parts));pathParts.set(key,parts);
          remaining.delete(key);progress=true;
        }
        if(!progress)fail(400,'Missing parent or cycle in legacy project hierarchy.');
      }
      const ensurePath=parts=>{
        if(!Array.isArray(parts) || !parts.length || parts.length>12)fail(400,'Invalid preview project path.');
        let parent=null;
        for(let index=0;index<parts.length;index+=1) {
          const key=JSON.stringify(parts.slice(0,index+1));
          parent=paths.get(key) || addProject(parts[index],parent,parts.slice(0,index+1));
        }
        return parent;
      };
      const copyLegacyFile=(source,workId,project,kind)=>{
        const raw=source[kind+'Path'];if(!raw)return;
        const filename=String(raw).replaceAll('\\','/').split('/').at(-1);
        if(!/^[a-zA-Z0-9_-]+$/.test(filename))fail(400,'Unsafe legacy upload filename.');
        const input=path.join(legacyUploadsDir,filename);
        if(!fs.existsSync(input)){result.warnings.push('Missing legacy '+kind+': '+filename);return;}
        if(!fs.statSync(input).isFile() || !fs.realpathSync(input).startsWith(fs.realpathSync(legacyUploadsDir)+path.sep))
          fail(400,'Legacy file escapes its upload directory.');
        const size=fs.statSync(input).size;
        if(!size || size>config.maxFileBytes){result.warnings.push('Skipped oversized or empty legacy file: '+filename);return;}
        const buffer=fs.readFileSync(input),mime=kind==='cover' ? imageMime(buffer) : 'application/octet-stream';
        if(!mime){result.warnings.push('Invalid legacy cover: '+filename);return;}
        checkStorageQuota(db,config,project,{[kind]:[{size}]});
        const file={id:id(),workId,kind,filename:id(),name:filename,mime,size};
        fs.writeFileSync(path.join(config.uploadsDir,file.filename),buffer,{flag:'wx',mode:0o600});
        addedFiles.push(file);insertFile(db,file);result.files+=1;
      };
      const addWork=(source,project)=>{
        if(!project)fail(400,'A sample work has no project.');
        const floor=Number(source.floorNum);
        if(!Number.isInteger(floor) || floor<1 || floor>7)fail(400,'Invalid sample work floor.');
        const number=db.prepare(`INSERT INTO work_sequences VALUES(?,?,1) ON CONFLICT(project_id,floor_num)
          DO UPDATE SET last_number=last_number+1 RETURNING last_number`).get(project.id,floor).last_number;
        const workId=project.id+':'+floor+':'+number;
        const createdAt=source.createdAt && !Number.isNaN(Date.parse(source.createdAt)) ? source.createdAt : date;
        db.prepare('INSERT INTO works VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(workId,text(source.title,'Work title'),project.id,floor,number,
          text(source.summary,'Summary',10000,false),text(source.prerequisite,'Prerequisite',10000,false),
          source.status==='done' ? 'done' : 'in_progress',ownerId,createdAt,date);
        for(const name of fixture.assigneeNames)db.prepare('INSERT INTO work_assignees VALUES(?,?)').run(workId,actors.get(name));
        for(const [reportIndex,report] of fixture.reports.entries()) {
          const reportBase=report.createdAt && !Number.isNaN(Date.parse(report.createdAt)) ? report.createdAt : date;
          const reportDate=new Date(Date.parse(reportBase)+reportIndex).toISOString();
          db.prepare('INSERT INTO reports VALUES(?,?,?,?,?,?)').run(id(),workId,actors.get(report.author),
            text(report.text,'Report text',10000),reportDate,reportDate);result.reports+=1;
        }
        for(const kind of ['cover','attachment'])copyLegacyFile(source,workId,project,kind);
        result.works+=1;
      };
      for(const work of fixture.legacy.works)addWork(work,legacyProjects.get(String(work.projectId)));
      // Preserve the original task-card order, ahead of the generated board examples.
      for(const [index,task] of fixture.tasks.entries())addWork({...task,
        createdAt:new Date(Date.parse(date)-index*1000).toISOString(),
      },ensurePath(task.projectPath));
      const boardProject=ensurePath(fixture.board.projectPath);
      result.boardProjectId=boardProject.id;
      const fa=number=>new Intl.NumberFormat('fa-IR',{useGrouping:false}).format(number);
      for(const row of fixture.board.rows) {
        const count=row.bubbles+row.more;
        if(!Number.isInteger(count) || count<0 || count>100)fail(400,'Invalid preview bubble count.');
        for(let index=1;index<=count;index+=1)addWork({
          floorNum:row.id,title:row.label+' – کار '+fa(index),status:'in_progress',
          createdAt:new Date(Date.parse(date)-86400000-index*1000).toISOString(),
          summary:'این توضیحات برای «'+row.label+'» است. شما در حال مشاهده وظیفه شماره '+fa(index)+' از این دسته می‌باشید.',
          prerequisite:'',
        },boardProject);
      }
      for(const root of roots)for(const actor of actors.values())db.prepare('INSERT INTO project_members VALUES(?,?)').run(root,actor);
      db.prepare('INSERT INTO original_preview_imports VALUES(?,?,?)').run(ownerId,fixture.version,JSON.stringify(result));
      return {...result,alreadyImported:false};
    });
  }catch(error){removeFiles(config,addedFiles);throw error;}
}
