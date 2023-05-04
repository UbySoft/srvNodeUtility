import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
//import {PitchDetector} from "pitchy";
import {AudioContext} from "web-audio-api";
import ffmpeg from "fluent-ffmpeg";
// import pkg from "wavefile";
// const {WaveFile} = pkg;
//
// Importa la libreria PitchFinder
import * as PitchFinder from "pitchfinder";

// Importa la libreria
import AudioBufferLoader from "audiobuffer-loader";

const app = express();
const upload = multer({dest: "uploads/"});

function isValidWavHeader(filePath) {
	const header = fs.readFileSync(filePath, {encoding: "binary", start: 0, end: 11});
	return header.startsWith("RIFF") && header.includes("WAVE", 4);
}

function convertToWav(inputPath, outputPath, callback) {
	ffmpeg(inputPath)
		.output(outputPath)
		.audioCodec("pcm_s16le")
		.audioFrequency(16000)
		.audioChannels(1)
		.on("end", () => {
			callback(null);
		})
		.on("error", (err) => {
			callback(err);
		})
		.run();
}

function frequencyToNote(frequency) {
	const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
	const semitonesFromA4 = Math.round(12 * Math.log2(frequency / 440));
	const noteIndex = (semitonesFromA4 + 69) % 12;
	const octave = Math.floor((semitonesFromA4 + 69) / 12);
	return noteNames[noteIndex] + octave;
}

app.post("/analyze", upload.single("audio"), async (req, res) => {
	try {
		console.log("req.file", req.file);
		const inputPath = path.join("uploads", req.file.filename);
		const outputPath = path.join("uploads", "converted_audio.wav");

		convertToWav(inputPath, outputPath, async (err) => {
			if (err) {
				console.error("Error converting audio:", err);
				res.status(500).json({error: "Error converting audio"});
			} else {
				console.log("Audio converted successfully");

				try {
					// Leggi il file audio come ArrayBuffer
					fs.readFile(outputPath, async (err, audioData) => {
						if (err) {
							console.error("Errore durante la lettura del file audio:", err);
							return;
						}

						// Crea un AudioContext utilizzando la libreria web-audio-api
						const audioContext = new AudioContext();

						// Decodifica i dati audio utilizzando decodeAudioData
						audioContext.decodeAudioData(audioData.buffer, (audioBuffer) => {
							// Crea un rilevatore di pitch
							const detectPitch = PitchFinder.YIN();

							// Rileva il pitch
							const pitch = detectPitch(audioBuffer.getChannelData(0));

							console.log("Pitch rilevato:", pitch);
							const nota = frequencyToNote(pitch);
							console.log("nota:", nota);
							res.json({nota: nota});
						});
					});

					// const fftSize = 2048; //Assicurati che sia una potenza di due e maggiore di uno, ad esempio, 2048 o 4096
					//const audioData = fs.readFileSync(outputPath);
					//const audioContext = new AudioContext();
					// audioContext.decodeAudioData(
					// 	audioData.buffer,
					// 	(audioBuffer) => {
					// 		const detector = new PitchDetector({
					// 			sampleRate: audioBuffer.sampleRate,
					// 			bufferSize: fftSize,
					// 		});
					// 		const pitch = detector.findPitch(audioBuffer.getChannelData(0));

					// 		res.json({frequency: pitch[0], clarity: pitch[1]});
					// 	},
					// 	(error) => {
					// 		console.error("Error decoding audio data:", error);
					// 		res.status(500).json({error: "Error decoding audio data"});
					// 	}
					//);
				} catch (error) {
					console.error("Error analyzing audio:", error);
					res.status(500).json({error: "Error analyzing audio"});
				} finally {
					fs.unlinkSync(req.file.path);
					fs.unlinkSync(outputPath);
				}
			}
		});
	} catch (error) {
		console.error("Error analyzing audio:", error);
		res.status(500).json({error: "Error analyzing audio"});
	}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
});
