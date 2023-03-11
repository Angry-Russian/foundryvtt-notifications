export default class NotificationsManager {

    #ping
    #lastPingTime = 0
    customPing

    constructor({
        prefix,
        ping
    } = {
        prefix: 'kolydim-extras-notifications',
        ping: undefined
    }){
        this.prefix = prefix;
        this.customPing = ping;

        if(Hooks && typeof Hooks.once === 'function')
            Hooks.once('ready', () => this.register());
        else throw new Error('Could not create "ready" Hook. Are you running this outside of FoundryVTT?');

    }

    register(){
        Notification.requestPermission().then( permission => {
            Hooks.on('renderChatMessage', (chatMessage, html, data) => this.notify(chatMessage, html, data));
        });

        game.settings.register(this.prefix, "enabled", {
            name: "Enable Notifications",
            hint: "Get notifications when someone speaks and the window isn't focused.",
            scope: "client",
            config: true,
            type: Boolean,
            default: false,
        });

        game.settings.register(this.prefix, "soundsEnabled", {
            name: "Enable Notification Sounds",
            hint: "Play a notification when you would receive a notification.",
            scope: "client",
            config: true,
            type: Boolean,
            default: true,
        });

        game.settings.register(this.prefix, "preferredPing", {
            name: "Notification Sound",
            hint: "Sound to play when a notification arrives.",
            scope: "client",
            config: true,
            type: String,
            default: 'dice-notif-light.mp3',
            choices: {
                'dice-notif-light.mp3': 'default - Dice light',
                'dice-notif-heavy.mp3': 'default - Dice heavy',
            },
            onChange: newPing => this.#setPing( newPing )
        });

        game.settings.register(this.prefix, "cooldown", {
            name: "Notification Cooldown",
            hint: "Minimum time before another notification can bother you.",
            scope: "client",
            config: true,
            type: Number,
            default: 30,
            choices: {
                0: 'Always play notifications',
                30: '30 seconds',
                60: '1 minute',
                300: '5 minutes',
                600: '10 minutes',

            },
        });

        this.#setPing()
    }

    #setPing( newPing = undefined ){
        this.customPing = newPing;
        this.#ping = game.audio.create({
            src: '/modules/notifications/resources/' + (this.customPing || game.settings.get(this.prefix, "preferredPing") || 'dice-notif-light.mp3'),
            preload: true,
            autoplay: false,
            singleton: true,
            autoplayOptions: { volume: 1 }
        });
    }

    notify(chatMessage, html, data){

        let serverTime = game.time.serverTime;

        if( !game.settings.get(this.prefix, "enabled") ) return;

        const messageTypes = Object.assign({}, ...Object.keys(CONST.CHAT_MESSAGE_TYPES).map(t => ({ [CONST.CHAT_MESSAGE_TYPES[t]]: t })))
        let tag = 'foundry-chat'
        let icon = data.author.avatar ?? CONST.DEFAULT_TOKEN
        let type = messageTypes[chatMessage.type] ?? 'unknown'
        let body = chatMessage.content
        let badge = '/icons/fvtt.png'

        switch(chatMessage.type){
            case CONST.CHAT_MESSAGE_TYPES.OTHER:
                icon = '/icons/fvtt.png'
                type = CONST.CHAT_MESSAGE_TYPES.OTHER.toString;
                break;
            case CONST.CHAT_MESSAGE_TYPES.OOC:
                type = 'CONST.CHAT_MESSAGE_TYPES.OOC';
                break;
            case CONST.CHAT_MESSAGE_TYPES.IC:
                if      (chatMessage.speaker.token) icon = game.canvas.tokens.get(chatMessage.speaker.token).img
                else if (chatMessage.speaker.actor) icon = game.actors.get(chatMessage.speaker.actor).img
                type = 'CONST.CHAT_MESSAGE_TYPES.IC';
                break;
            case CONST.CHAT_MESSAGE_TYPES.EMOTE:
                type = 'CONST.CHAT_MESSAGE_TYPES.EMOTE';
                break;
            case CONST.CHAT_MESSAGE_TYPES.WHISPER:
                type = 'CONST.CHAT_MESSAGE_TYPES.WHISPER';
                break;
            case CONST.CHAT_MESSAGE_TYPES.ROLL:
                icon = '/icons/fvtt.png'
                let content = $(html);
                let header = content.find('h4.dice-total').text() || content.text();
                body = `rolled ${header}`
                type = 'CONST.CHAT_MESSAGE_TYPES.ROLL';
                break;
        }

        // remove any leftover HTML tags
        body = body.replaceAll(/<\/?[\w\s=\"\-]+\/?>/g, ' ').replace(/\s+/, ' ').trim()
        if(!document.hasFocus())
        {
            if( (serverTime - this.#lastPingTime) > game.settings.get(this.prefix, "cooldown")*1000 ){
                this.#lastPingTime = serverTime
                game.audio.play(this.#ping.src, { volume: 1 });
            }
            let notif = new Notification(`${data.alias}:\t${body}`, {
                body, badge, icon, tag,
                requireInteraction: false, // TODO: set to true if an @me is detected
            });
        }
        console.log('Chat hook Args', chatMessage.speaker, {chatMessage, html, data})
    }
}

// sort-of equivalent of Python's `if __name__ == '__main__'` as long as you add "#module" to the import path
if(!import.meta.url.toString().endsWith('#module')){
    new NotificationsManager();
}