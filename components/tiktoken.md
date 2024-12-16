Tiktoken is a tokenizer library originally developed by OpenAI for use with their language models. It has been ported to JavaScript, allowing developers to tokenize text in Node.js and browser environments. Here's an overview of using tiktoken in JavaScript:
Installation
You can install the JavaScript version of tiktoken using npm:
bash
npm install tiktoken

Basic Usage
To use tiktoken in your JavaScript code, you typically follow these steps:
Import the necessary functions
Load the encoding for your desired model
Create a tokenizer instance
Encode text to tokens
Here's a basic example:
javascript
const { Tiktoken } = require("tiktoken/lite");
const { load } = require("tiktoken/load");
const registry = require("tiktoken/registry.json");
const models = require("tiktoken/model_to_encoding.json");

async function main() {
  const model = await load(registry[models["gpt-3.5-turbo"]]);
  const encoder = new Tiktoken(
    model.bpe_ranks,
    model.special_tokens,
    model.pat_str
  );
  
  const tokens = encoder.encode("Hello, world!");
  console.log(tokens);
  
  encoder.free();
}

main();

Advanced Usage
Custom Encodings
You can create a Tiktoken instance with custom ranks, special tokens, and regex patterns:
javascript
const { Tiktoken } = require("tiktoken");
const { readFileSync } = require("fs");

const encoder = new Tiktoken(
  readFileSync("./ranks/gpt2.tiktoken").toString("utf-8"),
  {
    "<|endoftext|>": 50256,
    "<|im_start|>": 100264,
    "<|im_end|>": 100265
  },
  "'s|'t|'re|'ve|'m|'ll|'d|?\\p{L}+|?\\p{N}+|?[^\\s\\p{L}\\p{N}]+|\\s+(?!\\S)|\\s+"
);

React Usage
You can use tiktoken in React applications as well:
jsx
import { get_encoding } from "tiktoken";
import { useState } from "react";

const encoding = get_encoding("cl100k_base");

export default function Home() {
  const [input, setInput] = useState("hello world");
  const tokens = encoding.encode(input);

  return (
    <div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <div>{tokens.toString()}</div>
    </div>
  );
}

Performance
The JavaScript implementation of tiktoken is quite fast, especially considering it's a port of the original Rust implementation. Here's a performance comparison for encoding different text sizes3:
Small text (68 tokens):
Pure JS: 0.05ms
JS/WASM: 0.11ms
Medium text (1068 tokens):
Pure JS: 0.96ms
JS/WASM: 0.78ms
Large text (923942 tokens):
Pure JS: 1005.69ms
JS/WASM: 451.92ms
As you can see, for smaller texts, the pure JavaScript implementation performs well, while for larger texts, the WebAssembly (WASM) version has a significant advantage.
Use Cases
Tiktoken is particularly useful when working with OpenAI's language models, as it allows you to:
Predict token usage for API calls, helping with cost estimation
Ensure your input doesn't exceed model token limits
Preprocess text for tokenization-aware operations
By understanding how words are converted to tokens, you can optimize your use of OpenAI's APIs and better manage your application's performance and costs2.
Remember to properly manage the tokenizer instance by calling encoder.free() when you're done using it to prevent memory leaks.