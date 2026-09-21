// index.js - Full voice conversation with Jarvis
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const say = require('say');
const readline = require('readline');
const record = require('node-record-lpcm16');
const wav = require('wav');
const speech = require('@google-cloud/speech');
require('dotenv').config();

class JarvisAssistant {
    constructor() {
        // API Configuration
        this.apiKey = process.env.GEMINI_API_KEY;
        this.apiVersion = 'v1beta';
        this.modelName = 'gemini-flash-latest';
        this.apiUrl = `https://generativelanguage.googleapis.com/${this.apiVersion}/models/${this.modelName}:generateContent`;
        
        // TTS settings
        this.ttsProvider = 'system';
        this.conversationHistory = [];
        this.isListening = false;
        this.mode = 'voice'; // Start in voice mode
        this.recordingDuration = 5; // Seconds to record
        
        // Initialize Google Speech-to-Text
        this.speechClient = new speech.SpeechClient({
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || null
        });
        
        // Setup readline for commands
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        console.log('\n╔══════════════════════════════════════════════════════╗');
        console.log('║                                                     ║');
        console.log('║            🎯 JARVIS - Voice Assistant            ║');
        console.log('║                                                     ║');
        console.log('╚══════════════════════════════════════════════════════╝\n');
        
        console.log(`🧠 AI Model: ${this.modelName}`);
        console.log('🎤 Voice Input: ENABLED (Speak to Jarvis)');
        console.log('🎧 Listening: Microphone');
        console.log('⏱️  Recording: 5 seconds per message');
        console.log('\nCommands:');
        console.log('  /text     - Switch to text typing mode');
        console.log('  /voice    - Switch to voice mode');
        console.log('  /duration - Change recording duration');
        console.log('  /exit     - Quit');
        console.log('  /read     - Reading exercise');
        console.log('  /sing     - Singing exercise');
        console.log('  /silent   - Toggle voice output');
        console.log('────────────────────────────────────────────────────────\n');
        
        // Check for SoX
        this.checkSoxInstallation();
        
        // Start with voice mode
        this.startVoiceConversation();
    }

    // ============ CHECK SOX INSTALLATION ============
    
    checkSoxInstallation() {
        const platform = process.platform;
        let checkCommand;
        
        if (platform === 'win32') {
            checkCommand = 'where sox';
        } else {
            checkCommand = 'which sox';
        }
        
        const proc = spawn(checkCommand, { shell: true });
        proc.on('error', () => {
            console.log('⚠️  SoX not found! Voice input may not work.');
            console.log('📝 Please install SoX:');
            console.log('  Windows: https://sourceforge.net/projects/sox/files/sox/14.4.2/');
            console.log('  Mac: brew install sox');
            console.log('  Linux: sudo apt-get install sox libsox-fmt-all');
            console.log('\n💡 You can still use /text mode to type.\n');
        });
        proc.on('close', (code) => {
            if (code === 0) {
                console.log('✅ SoX detected - Voice input ready!\n');
            }
        });
    }

    // ============ RECORD AUDIO FROM MICROPHONE ============
    
    async recordAudio() {
        return new Promise((resolve, reject) => {
            console.log('\n🎤 Listening... Speak now!');
            
            // Show countdown
            let seconds = this.recordingDuration;
            process.stdout.write(`⏱️  `);
            const timer = setInterval(() => {
                process.stdout.write(` ${seconds}s`);
                seconds--;
                if (seconds < 0) {
                    clearInterval(timer);
                    process.stdout.write(' \n');
                }
            }, 1000);
            
            const audioFile = path.join(__dirname, 'temp_audio.wav');
            const fileStream = fs.createWriteStream(audioFile);
            
            // Create WAV header
            const wavWriter = new wav.FileWriter(fileStream, {
                channels: 1,
                sampleRate: 16000,
                bitDepth: 16
            });
            
            // Start recording
            const recording = record.record({
                sampleRate: 16000,
                channels: 1,
                audioType: 'wav',
                recorder: 'sox',
                device: null,
                silence: '2.0',
                threshold: 0.1
            });
            
            recording.stream().pipe(wavWriter);
            
            // Stop after duration
            setTimeout(() => {
                clearInterval(timer);
                recording.stop();
                wavWriter.end();
                
                setTimeout(() => {
                    console.log('⏹️  Recording stopped\n');
                    resolve(audioFile);
                }, 500);
            }, this.recordingDuration * 1000);
            
            // Handle errors
            recording.on('error', (err) => {
                clearInterval(timer);
                console.error('❌ Recording error:', err.message);
                reject(err);
            });
        });
    }

    // ============ SPEECH TO TEXT - GOOGLE CLOUD ============
    
    async speechToText(audioPath) {
        try {
            // Read audio file
            const audioBytes = fs.readFileSync(audioPath).toString('base64');
            
            // Configure request
            const request = {
                audio: {
                    content: audioBytes
                },
                config: {
                    encoding: 'LINEAR16',
                    sampleRateHertz: 16000,
                    languageCode: 'en-US',
                    enableAutomaticPunctuation: true,
                    model: 'default'
                }
            };
            
            console.log('🔄 Converting speech to text...');
            
            // Detect speech
            const [response] = await this.speechClient.recognize(request);
            const transcription = response.results
                .map(result => result.alternatives[0].transcript)
                .join('\n');
            
            if (transcription && transcription.trim() !== '') {
                console.log(`🗣️  You said: ${transcription}`);
                return transcription;
            } else {
                console.log('🔇 No speech detected. Please try again.');
                return null;
            }
        } catch (error) {
            console.error('❌ Speech-to-Text Error:', error.message);
            
            // Fallback to text input if STT fails
            console.log('📝 Switching to text input for this message...');
            return await this.getTextInput('Type your message: ');
        }
    }

    // ============ GET TEXT INPUT (Fallback) ============
    
    getTextInput(prompt = 'You: ') {
        return new Promise((resolve) => {
            this.rl.question(`\x1b[36m${prompt}\x1b[0m`, (input) => {
                resolve(input);
            });
        });
    }

    // ============ GEMINI API ============
    
    async getGeminiResponse(userMessage) {
        try {
            const contents = this.conversationHistory.map(msg => ({
                role: msg.role,
                parts: msg.parts
            }));
            
            contents.push({
                role: "user",
                parts: [{ text: userMessage }]
            });
            
            const response = await axios.post(
                this.apiUrl,
                {
                    contents: contents,
                    generationConfig: {
                        maxOutputTokens: 250,
                        temperature: 0.8,
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-goog-api-key': this.apiKey
                    },
                    timeout: 30000
                }
            );
            
            if (response.data && response.data.candidates && response.data.candidates.length > 0) {
                const responseText = response.data.candidates[0].content.parts[0].text;
                
                this.conversationHistory.push({
                    role: "user",
                    parts: [{ text: userMessage }]
                });
                this.conversationHistory.push({
                    role: "model",
                    parts: [{ text: responseText }]
                });
                
                if (this.conversationHistory.length > 30) {
                    this.conversationHistory = this.conversationHistory.slice(-30);
                }
                
                return responseText;
            } else {
                return "I didn't quite get that. Could you please repeat?";
            }
        } catch (error) {
            console.error('API Error:', error.message);
            return "I'm having trouble processing. Could you please repeat that?";
        }
    }

    // ============ TTS ============
    
    async textToSpeech(text) {
        try {
            if (this.ttsProvider === 'none') {
                console.log(`📝 Jarvis: ${text}`);
                return true;
            }
            
            console.log(`🎯 Jarvis: ${text}`);
            return new Promise((resolve) => {
                say.speak(text, null, 1.0, (err) => {
                    if (err) {
                        console.error('TTS Error:', err);
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                });
            });
        } catch (error) {
            console.error('TTS Error:', error);
            console.log(`📝 Jarvis: ${text}`);
            return false;
        }
    }

    // ============ VOICE CONVERSATION LOOP ============
    
    async startVoiceConversation() {
        this.mode = 'voice';
        console.log('🎤 Voice mode activated! Speak to Jarvis.');
        console.log(`⏱️  Recording ${this.recordingDuration} seconds per message`);
        console.log('💬 Say your message clearly, then wait for response.\n');
        
        // Welcome message
        const welcome = "Hello! I'm Jarvis. I'm ready to talk with you. Just speak and I'll listen.";
        await this.textToSpeech(welcome);
        
        while (true) {
            try {
                // Record audio
                const audioFile = await this.recordAudio();
                
                // Convert speech to text
                const userMessage = await this.speechToText(audioFile);
                
                // Cleanup audio file
                try { 
                    fs.unlinkSync(audioFile); 
                } catch (e) {}
                
                if (!userMessage || userMessage.trim() === '') {
                    console.log('🎤 No input detected. Say something or type /text to switch modes.\n');
                    continue;
                }
                
                // Check for commands in speech
                const trimmedMessage = userMessage.trim().toLowerCase();
                if (trimmedMessage === 'exit' || trimmedMessage === 'quit') {
                    console.log('\n👋 Goodbye!');
                    await this.textToSpeech("Goodbye!");
                    process.exit(0);
                }
                
                if (trimmedMessage === 'switch to text mode' || trimmedMessage === 'text mode') {
                    console.log('📝 Switching to text mode...');
                    await this.textToSpeech("Switching to text mode.");
                    this.startTextConversation();
                    return;
                }
                
                if (trimmedMessage === 'reading exercise' || trimmedMessage === 'read') {
                    await this.startReadingExercise();
                    continue;
                }
                
                if (trimmedMessage === 'singing exercise' || trimmedMessage === 'sing') {
                    await this.startSingingExercise();
                    continue;
                }
                
                // Show thinking indicator
                process.stdout.write('🤔 Jarvis thinking');
                let dots = 0;
                const interval = setInterval(() => {
                    dots = (dots + 1) % 4;
                    process.stdout.write('\r🤔 Jarvis thinking' + '.'.repeat(dots) + '   ');
                }, 200);
                
                // Get AI response
                const response = await this.getGeminiResponse(userMessage);
                
                clearInterval(interval);
                process.stdout.write('\r' + ' '.repeat(30) + '\r');
                
                // Speak response
                await this.textToSpeech(response);
                
                console.log('🎤 Say something else... (or say "exit" to quit)\n');
                
            } catch (error) {
                console.error('❌ Error in voice loop:', error.message);
                console.log('💡 Continuing... Say something or type /text for text mode.\n');
            }
        }
    }

    // ============ TEXT CONVERSATION MODE ============
    
    async startTextConversation() {
        this.mode = 'text';
        console.log('\n💬 Text mode activated! Type your messages.');
        console.log('Type /voice to switch back to voice mode.\n');
        
        while (true) {
            try {
                const userMessage = await this.getTextInput();
                
                if (!userMessage || userMessage.trim() === '') {
                    continue;
                }
                
                // Handle commands
                if (userMessage.startsWith('/')) {
                    await this.handleCommand(userMessage);
                    continue;
                }
                
                // Show thinking indicator
                process.stdout.write('🤔 Thinking');
                let dots = 0;
                const interval = setInterval(() => {
                    dots = (dots + 1) % 4;
                    process.stdout.write('\r🤔 Thinking' + '.'.repeat(dots) + '   ');
                }, 200);
                
                const response = await this.getGeminiResponse(userMessage);
                
                clearInterval(interval);
                process.stdout.write('\r' + ' '.repeat(30) + '\r');
                
                await this.textToSpeech(response);
                console.log('');
                
            } catch (error) {
                console.error('Error:', error.message);
                console.log('💡 Let\'s continue...\n');
            }
        }
    }

    // ============ COMMANDS ============
    
    async handleCommand(command) {
        const cmd = command.toLowerCase().trim();
        
        switch(cmd) {
            case '/exit':
            case '/quit':
                console.log('\n👋 Goodbye!');
                await this.textToSpeech("Goodbye!");
                process.exit(0);
                break;
                
            case '/voice':
                if (this.mode === 'voice') {
                    console.log('🎤 Already in voice mode.');
                } else {
                    console.log('🎤 Switching to voice mode...');
                    await this.textToSpeech("Switching to voice mode.");
                    this.startVoiceConversation();
                }
                break;
                
            case '/text':
                if (this.mode === 'text') {
                    console.log('📝 Already in text mode.');
                } else {
                    console.log('📝 Switching to text mode...');
                    await this.textToSpeech("Switching to text mode.");
                    this.startTextConversation();
                }
                break;
                
            case '/duration':
                await this.changeDuration();
                break;
                
            case '/silent':
                if (this.ttsProvider === 'none') {
                    this.ttsProvider = 'system';
                    console.log('🔊 Jarvis voice ENABLED');
                    await this.textToSpeech("Voice enabled.");
                } else {
                    this.ttsProvider = 'none';
                    console.log('🔇 Jarvis voice DISABLED');
                }
                break;
                
            case '/clear':
                this.conversationHistory = [];
                console.log('🧹 Conversation cleared!');
                await this.textToSpeech("Conversation cleared.");
                break;
                
            case '/read':
                await this.startReadingExercise();
                break;
                
            case '/sing':
                await this.startSingingExercise();
                break;
                
            case '/help':
                this.showHelp();
                break;
                
            default:
                console.log(`❌ Unknown command: ${command}`);
                console.log('Type /help for available commands\n');
        }
    }

    // ============ CHANGE RECORDING DURATION ============
    
    async changeDuration() {
        console.log(`\n⏱️  Current recording duration: ${this.recordingDuration} seconds`);
        const input = await this.getTextInput('Enter new duration (3-10 seconds): ');
        const duration = parseInt(input);
        
        if (duration >= 3 && duration <= 10) {
            this.recordingDuration = duration;
            console.log(`✅ Recording duration set to ${duration} seconds\n`);
            await this.textToSpeech(`Recording duration set to ${duration} seconds.`);
        } else {
            console.log('❌ Invalid duration. Please enter a number between 3 and 10.\n');
        }
    }

    // ============ EXERCISES ============
    
    async startReadingExercise() {
        console.log('\n📖 Reading Exercise');
        const prompt = `Generate a short paragraph (2-3 sentences) for reading practice. Make it interesting and educational.`;
        const text = await this.getGeminiResponse(prompt);
        
        console.log('\n📝 Read this aloud:');
        console.log('═'.repeat(50));
        console.log(text);
        console.log('═'.repeat(50) + '\n');
        
        await this.textToSpeech("Please read this text aloud.");
        console.log('Say "again" to repeat or "done" to finish.');
        
        if (this.mode === 'voice') {
            console.log('🎤 Speak your response...');
            // In voice mode, they can just speak
        } else {
            const answer = await this.getTextInput('> ');
            if (answer.toLowerCase() === 'again') {
                await this.startReadingExercise();
            }
        }
        console.log('✅ Great job!\n');
    }

    async startSingingExercise() {
        console.log('\n🎵 Singing Exercise');
        const prompt = `Suggest a popular song and provide 2-3 lines from the chorus for karaoke practice.`;
        const song = await this.getGeminiResponse(prompt);
        
        console.log('\n🎤 Karaoke:');
        console.log('═'.repeat(50));
        console.log(song);
        console.log('═'.repeat(50) + '\n');
        
        await this.textToSpeech("Here's your karaoke song. Try singing along!");
        console.log('Say "next" for another song or "done" to finish.');
        
        if (this.mode === 'voice') {
            console.log('🎤 Speak your response...');
        } else {
            const answer = await this.getTextInput('> ');
            if (answer.toLowerCase() === 'next') {
                await this.startSingingExercise();
            }
        }
        console.log('🎤 Great singing!\n');
    }

    showHelp() {
        console.log('\n📖 Available Commands:');
        console.log('  /help    - Show this help');
        console.log('  /exit    - Quit');
        console.log('  /voice   - Switch to voice mode');
        console.log('  /text    - Switch to text mode');
        console.log('  /duration- Change recording duration (3-10s)');
        console.log('  /silent  - Toggle Jarvis voice');
        console.log('  /clear   - Clear conversation');
        console.log('  /read    - Reading exercise');
        console.log('  /sing    - Singing exercise');
        console.log('\n💡 In voice mode, just speak naturally!');
        console.log('💡 Say "exit" to quit, "text mode" to switch\n');
    }
}

// ============ START APPLICATION ============

const jarvis = new JarvisAssistant();

// Handle cleanup
process.on('SIGINT', () => {
    console.log('\n\n👋 Goodbye!');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('\n⚠️ Unexpected error:', error.message);
    console.log('💡 Continuing conversation...\n');
});