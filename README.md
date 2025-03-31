# 🗣️ POC Speech to Text APIs 🎙️

Este repositório contém POCs para explorar diferentes APIs de reconhecimento de fala. Cada uma dessas POCs foi projetada para testar funcionalidades de transcrição de áudio em tempo real e processamento de arquivos de áudio, com exemplos implementados em:

- **poc-aws**: Uso do Amazon Transcribe para transcrição de fala.
- **poc-aws-webpack**: Exemplo inicial de integração com Amazon Transcribe usando Webpack (baseado em [este guia](https://medium.com/@jannden/create-an-amazon-transcribe-web-app-with-javascript-a56c14b87db2)). **Observação**: Webpack foi usado como base, mas não será utilizado no projeto final.
- **poc-azure**: Integração com a API de Speech-to-Text da Microsoft Azure.
- **poc-gcloud**: Implementação com Google Cloud Speech-to-Text. (observação especial abaixo).
- **poc-openapi**: Utilização do OpenAI Whisper para transcrição de áudio (observação especial abaixo).

## ⚙️ Como Compilar e Executar

Para testar cada POC, siga os passos abaixo:

1. No terminal, navegue até a pasta desejada:
    ```bash
    cd nome-da-poc
    ```
2. Instale as dependências necessárias:
    ```bash
    npm install
    ```
3. Inicie o projeto:
    ```bash
    npm start
    ```
    

## 🚨 Observação para testar a POC com Google Cloud Speech-to-Text

Para testar a **poc-gcloud**, será necessário realizar a autenticação com as Credenciais Padrão de Aplicativo (Application Default Credentials - ADC). A organização não permite a criação de chaves privadas, então o projeto foi configurado para usar este método de autenticação. Antes de iniciar o projeto, execute o seguinte comando no terminal:

```bash

gcloud auth application-default login
```

## 🔍 Observação Importante sobre a POC com OpenAI Whisper

A **API OpenAI Whisper Speech-to-Text** não oferece suporte a **transcrição em tempo real** (real-time streaming). Ela é projetada para transcrever **arquivos de áudio pré-gravados**, realizando a transcrição somente após o envio do arquivo. Isso significa que a transcrição será gerada **após a finalização da gravação de áudio**.

Para transcrição em tempo real, é recomendado o uso das APIs que suportam streaming contínuo, permitindo capturar e transcrever o áudio conforme ele é gerado. Essas APIs são:

- **Google Cloud Speech-to-Text**
- **Microsoft Azure Speech**
- **Amazon Transcribe**

---
