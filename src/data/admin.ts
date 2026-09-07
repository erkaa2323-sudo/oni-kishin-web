/**
 * ONI CONTROL CENTER — admin data boundary.
 */
import { applicationsService, garageService, meetService, membersService, musicService } from "@/services/domains";
import { listAuditEvents, recordAuditEvent } from "@/services/audit";
import { reviewMemberAccount } from "@/data/member-auth";

export const ADMIN_BACKEND_CONNECTED = true;
export const ADMIN_AUTH_CONNECTED = true;
export const ADMIN_AI_CONNECTED = true;

export type AdminRole = "owner" | "admin" | "moderator";
export type AdminPermission = "members.read" | "members.write" | "garage.read" | "garage.write" | "applications.review" | "meet.control" | "music.write" | "system.read" | "audit.read" | "ai.execute";
export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  owner: ["members.read","members.write","garage.read","garage.write","applications.review","meet.control","music.write","system.read","audit.read","ai.execute"],
  admin: ["members.read","members.write","garage.read","garage.write","applications.review","meet.control","music.write","system.read","audit.read"],
  moderator: ["members.read","garage.read","applications.review","audit.read"],
};
export type AdminModuleId = "overview" | "members" | "accounts" | "garage" | "applications" | "meet" | "music" | "system" | "audit" | "command";
export type AdminModule = { id: AdminModuleId; label: string; code: string; index: string; desc: string };
export const ADMIN_MODULES: AdminModule[] = [
  { id:"overview",label:"ЕРӨНХИЙ",code:"OVERVIEW",index:"00",desc:"Үйл ажиллагааны төлөв" },
  { id:"members",label:"ГИШҮҮД",code:"MEMBERS",index:"01",desc:"Гишүүдийн бүртгэл" },
  { id:"accounts",label:"CREW ACCOUNT",code:"MEMBER AUTH",index:"01A",desc:"Гишүүний нэвтрэх хүсэлт" },
  { id:"garage",label:"ГАРАЖ",code:"GARAGE",index:"02",desc:"Автомашины бүртгэл" },
  { id:"applications",label:"АНКЕТ",code:"APPLICATIONS",index:"03",desc:"Элсэлтийн хүсэлт" },
  { id:"meet",label:"УУЛЗАЛТ",code:"MEET CONTROL",index:"04",desc:"Уулзалтын удирдлага" },
  { id:"music",label:"ХӨГЖИМ / AI",code:"MUSIC / AI DATA",index:"05",desc:"Контент ба мэдлэгийн сан" },
  { id:"system",label:"СИСТЕМ",code:"SYSTEM HEALTH",index:"06",desc:"Системийн төлөв" },
  { id:"audit",label:"БҮРТГЭЛ",code:"AUDIT LOG",index:"07",desc:"Үйлдлийн түүх" },
  { id:"command",label:"ОНИ КОМАНД",code:"ONI AI COMMAND",index:"08",desc:"AI командын самбар" },
];
export type ServiceKey = "backend"|"database"|"auth"|"ai"|"meet"|"storage";
export type ServiceStatus={key:ServiceKey;label:string;code:string;state:"connected"|"not_connected"|"unknown";note:string};
export function getServiceStatuses():ServiceStatus[]{return[
 {key:"backend",label:"СЕРВЕР",code:"BACKEND",state:"connected",note:"Firebase үйлчилгээ идэвхтэй."},
 {key:"database",label:"ӨГӨГДЛИЙН САН",code:"DATABASE",state:"connected",note:"Firestore мэдээллийн сан холбогдсон."},
 {key:"auth",label:"НЭВТРЭЛТ",code:"AUTH",state:"connected",note:"Нэвтрэлтийн үйлчилгээ идэвхтэй."},
 {key:"ai",label:"ОНИ БРЭЙН",code:"AI ENGINE",state:"connected",note:"ОНИ Брэйн идэвхтэй (нийтэд нээлттэй өгөгдөл дээр)."},
 {key:"meet",label:"УУЛЗАЛТ",code:"MEET SERVICE",state:"unknown",note:"Уулзалтын хүснэгт идэвхтэй. Баталгаажуулалтын сервер хараахан идэвхжээгүй."},
 {key:"storage",label:"ФАЙЛ САН",code:"STORAGE",state:"connected",note:"Зураг болон аудио шууд холбоосоор ажиллана."},
]}
export type AdminMemberRecord={id:string;cpmNickname:string;cpmId:string;role:string;portraitUrl:string;status:"active"|"inactive"|"archived";joinedAt?:string};
export type AdminVehicleRecord={id:string;model:string;owner:string;category:string;build:string;imagePath:string;status:"published"|"draft"|"archived"};
export type AdminApplicationRecord={id:string;cpmNickname:string;cpmId:string;contact:string;message:string;experience:string;submittedAt:string;state:"pending"|"accepted"|"rejected"};
export type AdminMeetRecord={id:string;title:string;scheduledAt:string;endsAt:string;registrationClosesAt:string;capacity:number;status:"draft"|"scheduled"|"live"|"ended"|"closed"};
export type AdminRegistrationRecord={id:string;cpmNickname:string;cpmId:string;createdAt:string};
export type AdminTrackRecord={id:string;title:string;artist:string;source:string;sortOrder:number;durationSeconds:number;status:"published"|"draft"};
export type AuditEvent={id:string;at:string;actor:string;action:string;target:string;severity:"info"|"warning"|"critical"};
export type DataResult<T>={status:"ok";rows:T[]}|{status:"unavailable";reason:string};
const UNAVAILABLE=(reason:string)=>({status:"unavailable" as const,reason});
async function toResult<T,R>(load:()=>Promise<{ok:true;data:T[]}|{ok:false;error:{message:string}}>,map:(row:T)=>R):Promise<DataResult<R>>{const res=await load();if(!res.ok)return UNAVAILABLE(res.error.message);return{status:"ok",rows:res.data.map(map)}}
export async function getMembers():Promise<DataResult<AdminMemberRecord>>{return toResult(membersService.list,m=>({id:m.id,cpmNickname:m.cpmNickname,cpmId:m.cpmId,role:m.role??"",portraitUrl:m.portraitUrl??"",status:m.status,...(m.joinedAt?{joinedAt:m.joinedAt}:{})}))}
export async function getVehicles():Promise<DataResult<AdminVehicleRecord>>{return toResult(garageService.list,v=>({id:v.id,model:v.model,owner:v.ownerName??"—",category:v.category??"",build:v.build??"",imagePath:v.imagePath??"",status:v.status}))}
export async function getApplications():Promise<DataResult<AdminApplicationRecord>>{return toResult(applicationsService.list,a=>({id:a.id,cpmNickname:a.cpmNickname,cpmId:a.cpmId,contact:a.contact,message:a.message??"",experience:a.experience??"",submittedAt:a.createdAt??"",state:a.state}))}
export async function getMeets():Promise<DataResult<AdminMeetRecord>>{return toResult(meetService.list,m=>({id:m.id,title:m.title,scheduledAt:m.scheduledAt??"",endsAt:m.endsAt??"",registrationClosesAt:m.registrationClosesAt??"",capacity:m.capacity??0,status:m.status}))}
export async function getRegistrations(meetId:string):Promise<DataResult<AdminRegistrationRecord>>{return toResult(()=>meetService.listRegistrations(meetId),r=>({id:r.id,cpmNickname:r.cpmNickname,cpmId:r.cpmId,createdAt:r.createdAt??""}))}
export async function getTracks():Promise<DataResult<AdminTrackRecord>>{return toResult(musicService.list,t=>({id:t.id,title:t.title,artist:t.artist??"",source:t.sourceUrl??"",sortOrder:t.sortOrder,durationSeconds:t.durationSeconds??0,status:t.status}))}
export async function getAuditEvents():Promise<DataResult<AuditEvent>>{return toResult(()=>listAuditEvents(100),e=>({id:e.id,at:e.createdAt??"",actor:e.actorRole,action:e.action,target:e.target??"—",severity:e.severity}))}
export type AdminActionKind="member.create"|"member.update"|"member.archive"|"member.delete"|"member_account.approve"|"member_account.reject"|"vehicle.create"|"vehicle.update"|"vehicle.archive"|"vehicle.delete"|"application.accept"|"application.reject"|"application.promote"|"meet.create"|"meet.update"|"meet.start"|"meet.end"|"meet.close"|"meet.rotate_credentials"|"meet.registration_remove"|"track.create"|"track.update"|"track.delete"|"prompt.update";
export type RiskLevel="low"|"medium"|"high";
export const ACTION_RISK:Partial<Record<AdminActionKind,RiskLevel>>={"member.delete":"high","vehicle.delete":"high","track.delete":"high","meet.end":"high","meet.close":"high","meet.rotate_credentials":"high","meet.registration_remove":"medium","member.archive":"medium","member_account.approve":"medium","member_account.reject":"medium","application.promote":"medium","vehicle.archive":"medium","application.reject":"medium","application.accept":"medium","meet.start":"medium"};
export type AdminActionRequest={kind:AdminActionKind;targetId?:string;payload?:Record<string,unknown>};
export type AdminActionResult={ok:true;auditEventId:string}|{ok:false;error:string};
export type AdminActor={uid:string;role:AdminRole};
const ACTION_PERMISSION:Record<AdminActionKind,AdminPermission>={"member.create":"members.write","member.update":"members.write","member.archive":"members.write","member.delete":"members.write","member_account.approve":"members.write","member_account.reject":"members.write","vehicle.create":"garage.write","vehicle.update":"garage.write","vehicle.archive":"garage.write","vehicle.delete":"garage.write","application.accept":"applications.review","application.reject":"applications.review","application.promote":"members.write","meet.create":"meet.control","meet.update":"meet.control","meet.start":"meet.control","meet.end":"meet.control","meet.close":"meet.control","meet.rotate_credentials":"meet.control","meet.registration_remove":"meet.control","track.create":"music.write","track.update":"music.write","track.delete":"music.write","prompt.update":"ai.execute"};
function permitted(actor:AdminActor|null,permission:AdminPermission){return !!actor&&ROLE_PERMISSIONS[actor.role].includes(permission)}
export async function dispatchAdminAction(req:AdminActionRequest,actor:AdminActor|null):Promise<AdminActionResult>{if(!actor)return{ok:false,error:"Нэвтэрсэн админ хэрэглэгч шаардлагатай."};const permission=ACTION_PERMISSION[req.kind];if(!permitted(actor,permission))return{ok:false,error:"Энэ үйлдлийг хийх эрх танд байхгүй."};const payload={...(req.payload??{}),updated_by:actor.uid,created_by:actor.uid};let result:{ok:true;data:{id:string}}|{ok:false;error:{message:string}};switch(req.kind){case"member.create":result=await membersService.create(payload);break;case"member.update":if(!req.targetId)return{ok:false,error:"Гишүүний ID дутуу."};result=await membersService.update(req.targetId,payload);break;case"member.archive":if(!req.targetId)return{ok:false,error:"Гишүүний ID дутуу."};result=await membersService.archive(req.targetId);break;case"member.delete":if(!req.targetId)return{ok:false,error:"Гишүүний ID дутуу."};result=await membersService.remove(req.targetId);break;case"member_account.approve":case"member_account.reject":if(!req.targetId)return{ok:false,error:"Crew account ID дутуу."};{const reviewed=await reviewMemberAccount(req.targetId,req.kind.endsWith("approve")?"approved":"rejected",actor.uid);result=reviewed.ok?{ok:true,data:{id:req.targetId}}:{ok:false,error:{message:reviewed.message}}}break;case"vehicle.create":result=await garageService.create(payload);break;case"vehicle.update":if(!req.targetId)return{ok:false,error:"Машины ID дутуу."};result=await garageService.update(req.targetId,payload);break;case"vehicle.archive":if(!req.targetId)return{ok:false,error:"Машины ID дутуу."};result=await garageService.archive(req.targetId);break;case"vehicle.delete":if(!req.targetId)return{ok:false,error:"Машины ID дутуу."};result=await garageService.remove(req.targetId);break;case"application.accept":case"application.promote":if(!req.targetId)return{ok:false,error:"Анкетын ID дутуу."};result=await applicationsService.acceptAndPromote(req.targetId,{cpmNickname:String(payload["cpm_nickname"]??""),cpmId:String(payload["cpm_id"]??"")},actor.uid);break;case"application.reject":if(!req.targetId)return{ok:false,error:"Анкетын ID дутуу."};result=await applicationsService.review(req.targetId,"rejected",actor.uid);break;case"meet.create":result=await meetService.create(payload);break;case"meet.update":if(!req.targetId)return{ok:false,error:"Уулзалтын ID дутуу."};result=await meetService.update(req.targetId,payload);break;case"meet.start":case"meet.end":case"meet.close":if(!req.targetId)return{ok:false,error:"Уулзалтын ID дутуу."};result=await meetService.setStatus(req.targetId,req.kind==="meet.start"?"live":req.kind==="meet.end"?"ended":"closed");break;case"meet.rotate_credentials":if(!req.targetId)return{ok:false,error:"Уулзалтын ID дутуу."};result=await meetService.rotateCredentials(req.targetId,String(payload["room_id"]??""),String(payload["room_password"]??""),actor.uid);break;case"meet.registration_remove":if(!req.targetId)return{ok:false,error:"Бүртгэлийн ID дутуу."};result=await meetService.removeRegistration(req.targetId);break;case"track.create":result=await musicService.create(payload);break;case"track.update":if(!req.targetId)return{ok:false,error:"Трекийн ID дутуу."};result=await musicService.update(req.targetId,payload);break;case"track.delete":if(!req.targetId)return{ok:false,error:"Трекийн ID дутуу."};result=await musicService.remove(req.targetId);break;default:return{ok:false,error:"Энэ үйлдэл backend-т холбогдоогүй байна."}}if(!result.ok)return{ok:false,error:result.error.message};const audit=await recordAuditEvent({actorUid:actor.uid,actorRole:actor.role,action:req.kind,target:req.targetId??result.data.id,severity:ACTION_RISK[req.kind]??"low",result:"success"});return{ok:true,auditEventId:audit.ok?audit.data.id:"audit-unavailable"}}
export const COMMAND_TIERS=[{id:"read",code:"TIER 1",label:"УНШИХ",desc:"Зөвхөн бодит өгөгдөл уншина."},{id:"prepare",code:"TIER 2",label:"БЭЛТГЭХ",desc:"Өөрчлөлтийн төлөвлөгөө бэлтгэнэ."},{id:"execute",code:"TIER 3",label:"ГҮЙЦЭТГЭХ",desc:"Баталгаажуулалтын дараа л өөрчилнө."}] as const;
export type CommandTier=(typeof COMMAND_TIERS)[number]["id"];
export const COMMAND_SUGGESTIONS=[{tier:"read" as const,text:"Хүлээгдэж буй анкетуудыг шалга"},{tier:"read" as const,text:"Удахгүй болох уулзалтыг харуул"},{tier:"prepare" as const,text:"Идэвхгүй гишүүнийг архивлах төлөвлөгөө бэлтгэ"}];
export type CommandPlan={tier:CommandTier;rationale:string;actions:{kind:AdminActionKind;summary:string;risk:RiskLevel;missingParams:string[]}[]};
export type CommandResponse={status:"plan";plan:CommandPlan}|{status:"error";message:string};
export async function submitCommand(input:string,tier:CommandTier):Promise<CommandResponse>{const q=input.trim().toLowerCase();if(!q)return{status:"error",message:"Команд хоосон байна."};if(q.includes("анкет")){const r=await getApplications();if(r.status!=="ok")return{status:"error",message:r.reason};const pending=r.rows.filter(x=>x.state==="pending");return{status:"plan",plan:{tier,rationale:`Хүлээгдэж буй ${pending.length} анкет байна.`,actions:[]}}}if(q.includes("уулзалт")||q.includes("meet")){const r=await getMeets();if(r.status!=="ok")return{status:"error",message:r.reason};return{status:"plan",plan:{tier,rationale:`Нийт ${r.rows.length} уулзалтын бичлэг байна.`,actions:[]}}}return{status:"plan",plan:{tier,rationale:"Командыг ойлгосон боловч аюулгүй байдлын үүднээс автоматаар өөрчлөх үйлдэл сонгосонгүй.",actions:[]}}}
