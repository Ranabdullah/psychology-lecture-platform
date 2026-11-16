import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main(){
 const teacherPassword=process.env.SEED_TEACHER_PASSWORD, studentPassword=process.env.SEED_STUDENT_PASSWORD;
 if(!teacherPassword||!studentPassword||teacherPassword.length<12||studentPassword.length<12||teacherPassword===studentPassword)throw new Error('Choose two different 12+ character seed passwords in your private environment file.');
 const teacher=await prisma.user.upsert({where:{username:'example_teacher'},update:{},create:{username:'example_teacher',displayName:'Example Teacher',email:'teacher@example.invalid',role:'TEACHER',passwordHash:await bcrypt.hash(teacherPassword,12)}});
 await prisma.user.upsert({where:{username:'example_student'},update:{},create:{username:'example_student',displayName:'Example Student',email:'student@example.invalid',role:'STUDENT',passwordHash:await bcrypt.hash(studentPassword,12)}});
 const examples: Array<[string,string,string]> = [['example-getting-started','Example — Getting started','Fictional demonstration draft. Replace with your own authorised recording.'],['example-study-notes','Example — Organising study notes','Fictional demonstration draft for testing teacher review and student publication.']];
 for(const [id,title,description]of examples)await prisma.lecture.upsert({where:{id},update:{},create:{id,title,description,category:'Example',primaryLanguage:'ENGLISH',status:'DRAFT',createdById:teacher.id}});
 console.log('Created two fictional draft examples. No clinical teaching content or recordings were seeded.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
