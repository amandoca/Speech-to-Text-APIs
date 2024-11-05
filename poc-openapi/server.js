require("dotenv").config();
const express = require("express");
const http = require("http");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const server = http.createServer(app);

// Configurar o armazenamento do multer para memória
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware para servir arquivos estáticos da pasta 'public'
app.use(express.static("public"));

// Endpoint para transcrição
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo de áudio enviado." });
  }

  try {
    const transcript = await transcribeAudio(req.file);
    res.json({ transcript: transcript });
  } catch (error) {
    console.error("Erro na transcrição:", error);
    res.status(500).json({ error: "Erro na transcrição." });
  }
});

// Função para transcrever áudio usando a API da OpenAI
async function transcribeAudio(file) {
  const apiKey = process.env.OPENAI_API_KEY;
  const apiUrl = "https://api.openai.com/v1/audio/transcriptions";

  const formData = new FormData();
  formData.append("file", file.buffer, {
    filename: file.originalname,
    contentType: file.mimetype,
  });
  formData.append("model", "whisper-1");
  formData.append("language", "pt");

  const response = await axios.post(apiUrl, formData, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...formData.getHeaders(),
    },
  });

  if (response.data && response.data.text) {
    return response.data.text;
  } else {
    throw new Error("Transcrição falhou.");
  }
}

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor ouvindo na porta ${PORT}`);
});
