//@ts-check
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters"
import "dotenv/config"

/** 
	@typedef {Object} UserState 
	@property {boolean} active
	@property {string} group
	@property {string} username
	@property {number} pending
	@property {Array<string>} msg
*/

/** 
	@type {Object<number, UserState>} active_users 
	
*/
let active_users = {
	
}
const bot = new Telegraf(process.env.BOT_TOKEN || "");
let playing = false;

// Lista de grupos permitida (no estoy seguro si soporta más de un grupo)
const allowed_chat = {};
allowed_chat[process.env.CHAT_ID] = true;

const allowed_admins = {};
allowed_admins[Number(process.env.ADMIN_ID)] = true;

// Revelación de algunos mensajes y finalización de ronda, reseat de jugadores y mensajes
setInterval(async ()=>{
	if(active_users && playing){
		for (let user in active_users) {
			await bot.telegram.sendMessage(active_users[user].group, "Se terminó la ronda y se revelarán hasta...");
			let number = await bot.telegram.sendDice(active_users[user].group);
			await bot.telegram.sendMessage(active_users[user].group, `${number.dice.value} mensajes aleatorios!!!`);
			revelar_mensajes(number.dice.value, active_users[user].group);
			break;
		}

	} else {
		console.log("idle, sin nadie jugando")
	}
}, 3_600_000); // Cada 3 horas son 10_800_000

/** 
	@param {number} number 
	@param {string} id  
*/
async function revelar_mensajes(number, id){
	try {
		let ids = []; let max = 0, max_count = 0;
		for(let i in active_users){
			ids.push(Number(i));

			let length = active_users[i].msg.length;
			max = Math.max(length, max);
			max_count += length;
		}

		if(max === 0){
			playing = false;
			return await bot.telegram.sendMessage(id, "Hijos de su preciosa madre, ningúno dijo nada!!!\n\nYa veo que les da miedito");
		}

		// console.log(ids);

		if (max_count < number) { // Si hay menos mensajes que los que puso el dado
			number = max_count;
		}

		// Falta que no se repitan los mensajes
		for(let i = 0; i < number; i+=1){

			if(ids.length === 0){
				break;
			}

			let rand_i = Math.trunc(Math.random() * ids.length);
			let random_usr = ids[rand_i];
			let random_msg = Math.trunc(Math.random() * active_users[random_usr].msg.length);
			let final = active_users[random_usr].msg[random_msg];

			await bot.telegram.sendMessage(id, `El usuario ${active_users[random_usr].username} dijo: \n\n"${final}"\n\n\u{1F64A}`);
			active_users[random_usr].msg.splice(random_msg, 1); // Removes the msg
			if (active_users[random_usr].msg.length == 0) { // If no more msg
				ids.splice(rand_i, 1);
			}
		}

		active_users = {}
		playing = false;
		
	} catch (err) {
		console.log(err)	
		// Reinicio perdiendo todo
		active_users = {};
		playing = false;
	}
}

bot.start((ctx)=>{
	ctx.reply(`Bienvenido ${ctx.message.from.first_name} \u{1F60C}`);
})

bot.on(message("new_chat_members"), async (ctx)=>{
	let is_channel = ctx.update.message.chat.type;
	if (ctx.update.message.chat.type.includes("channel")){
		ctx.leaveChat();
	}

	let chat_id = ctx.update.message.chat.id;
	let adder_id = ctx.update.message.from.id;

	// Si no lo agrega un admin autorizado o se agrega a un grupo no autorizado, se sale
	if (allowed_chat[chat_id.toString()] && allowed_admins[adder_id]){
		await ctx.replyWithDice();
		await ctx.reply(`¿Están listos?\u{1F60F}\n\nPara jugar es muy sencillo, pongan \/quiero\n\n- Vayan al privado del bot y escriban\n\n¡Pero recuerden, solo tienen seis mensajes por día! y algo más...\u{1F60F}\n\nAl final del día se revelarán mensajes depediendo del dadito \u{1F649}`)
	} else {
		// console.log(ctx.chat)
		await ctx.leaveChat();
	}
});

// let bot_id = Number(process.env.BOT_ID);
// bot.on(message("reply_to_message"), (ctx)=>{ // Para agregar sistema de puntuaciones
// 	// Recibir las puntuaciones
// 	if (ctx.update.message.reply_to_message.from?.id === bot_id){
// 		console.log(ctx.message, "<-")
// 	}
// });

bot.command("stop", async (ctx)=>{
	// Un admin la apaga
	if (allowed_admins[ctx.from.id]){
		await ctx.reply("Se salvaron, la ronda terminó");
		active_users = {};
		playing = false;
	}
})

// bot.command("emergencia", async (ctx)=>{ // Pendiente
// 	// Un admin revela todos los mensajes
// 	if (allowed_admins[ctx.from.id]){
// 		for (let i in active_users) {
// 			for (msg in active_users[i].msg){

// 			}
// 		}
// 		active_users = {};
// 		playing = false;
// 	}
// })

bot.command("quiero", async (ctx)=>{
	active_users[ctx.from.id] = {active: true, group: String(ctx.chat.id), pending: 6, msg: [], username: ctx.from.first_name};
	await ctx.reply(`${ctx.from.first_name} añadido \u{2795}`);
	playing = true;
})

bot.on(message("text"), async (ctx)=>{
	if (ctx.update.message.chat.type != "private"){
		return;
	}

	let user_id = ctx.from.id;

	// Enviar en anónimo al grupo
	if (active_users[user_id]){
		if (active_users[user_id].pending > 0){
			try {
				await bot.telegram.sendMessage(active_users[user_id].group, ctx.text);
				active_users[user_id].msg.push(ctx.text);

			} catch (error) {
				console.log(error)
			}

			active_users[user_id].pending -= 1;
		} else {
			await ctx.reply("Agotaste tus mensajes por hoy, no me jodas \u{1F612}");
		}
	} else {
		await ctx.reply("Ve al grupo a registrarte, hijo de tu muy buena y fruta madre \u{1F64A}, una nueva ronda empezó!");
	}
})

bot.launch()

// Terminar el proceso
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
