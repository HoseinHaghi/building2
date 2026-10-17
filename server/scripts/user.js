import { configuration } from '../config.js';
import { openDatabase } from '../db.js';
import { hashPassword } from '../security.js';
import { id,now } from '../domain.js';
const config=configuration(),db=openDatabase(config.databasePath);
try {
  const [command,argument]=process.argv.slice(2),username=(argument || '').toLowerCase(),password=process.env.BUILDING_USER_PASSWORD;
  if(!/^[a-z0-9_]{3,40}$/.test(username) || !password || password.length<10 || password.length>128)
    throw new Error('Provide a valid username and a 10–128 character BUILDING_USER_PASSWORD environment variable.');
  const hash=await hashPassword(password);
  if(command==='create'){
    const name=process.env.BUILDING_USER_NAME || username,email=(process.env.BUILDING_USER_EMAIL || '').toLowerCase();
    if(name.length>100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Provide BUILDING_USER_NAME and a valid BUILDING_USER_EMAIL.');
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(id(),name,username,email,hash,now());console.log('Account created.');
  }else if(command==='reset'){
    const user=db.prepare('SELECT id FROM users WHERE username=?').get(username);
    if(!user)throw new Error('User not found.');
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash,user.id);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);console.log('Password reset; all sessions revoked.');
  }else throw new Error('Use create or reset.');
}catch(error){console.error(error.message);process.exitCode=1;}finally{db.close();}
