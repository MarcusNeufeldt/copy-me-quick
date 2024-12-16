# 🚀 Copy Me Quick: Your Bridge to LLM Code Understanding

[![Next.js](https://img.shields.io/badge/Next.js-14.2.5-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.0+-61dafb.svg)](https://reactjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4.1-38bdf8.svg)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Live Demo](https://img.shields.io/badge/demo-online-green.svg)](https://copymequick.vercel.app/)

## 📖 Overview

Copy Me Quick is a specialized tool designed to revolutionize how you interact with Large Language Models (LLMs) when analyzing codebases. It intelligently prepares and processes your code to optimize token usage while preserving semantic meaning, solving the critical challenge of LLM context window limitations.

Try it now at [copymequick.vercel.app](https://copymequick.vercel.app/)!

### The LLM Token Challenge
LLMs have context window limitations measured in tokens. Without proper optimization, you face:
- **Truncated Input:** Incomplete code understanding
- **High Costs:** Excessive token usage
- **Inefficient Analysis:** Wasted tokens on irrelevant code

## ✨ Key Features

### 📁 Smart Project Management
- **Interactive File Tree**: Hierarchical visualization with size indicators
- **Framework-Aware Presets**: Automatic exclusion of irrelevant folders (node_modules, .git, etc.)
- **Customizable Filters**: Fine-tune included/excluded files and folders

### 🔢 Token Optimization
- **Real-time Token Estimation**: Using tiktoken for accurate counts
- **Token Usage Visualization**: Progress bar for context window limits
- **Minification Options**: Preserve logic while reducing token count

### 🎨 Modern UI & UX
- **Radix UI Components**: Clean, accessible interface
- **Interactive Selection**: Easy file/folder inclusion/exclusion
- **Visual Feedback**: Progress indicators and tooltips
- **Responsive Design**: TailwindCSS-powered adaptable layout

### 🔄 Advanced Processing
- **File Content Analysis**: Smart content processing
- **ZIP Integration**: Efficient file handling
- **Backup & Restore**: Save and reload project states
- **Export/Import**: Share project configurations

## 🛠️ Technical Stack

- **Framework**: Next.js 14.2.5
- **UI Library**: React 18 with TypeScript
- **Styling**: TailwindCSS 3.4.1 with tailwind-merge
- **Components**: Radix UI primitives
- **File Handling**: react-dropzone, JSZip
- **Token Processing**: tiktoken
- **Analytics**: Vercel Analytics
- **Deployment**: Vercel

## 🚀 Getting Started

1. **Installation**
   ```bash
   git clone https://github.com/your-username/copy-me-quick.git
   cd copy-me-quick
   npm install
   # or
   yarn install
   ```

2. **Development**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

3. **Build**
   ```bash
   npm run build
   # or
   yarn build
   ```

## 💡 Usage Guide

1. **Select Project Type**
   - Choose from preset frameworks or configure manually
   - Automatic exclusion of common irrelevant directories

2. **Configure Project**
   - Use the file tree for granular selection
   - Enable/disable minification
   - Set token budget limits

3. **Process & Copy**
   - Monitor token usage in real-time
   - Copy optimized code to clipboard
   - Export project state if needed

4. **LLM Integration**
   ```markdown
   Example Prompt:
   I've provided a structured representation of my codebase using Copy Me Quick.
   Project structure:
   [Paste Project Structure]
   
   Selected files:
   [Paste Selected Files]
   
   Goal: [Your analysis request]
   ```

## 🔧 Configuration

The project uses several configuration files:
- `next.config.js` - Next.js configuration
- `tailwind.config.ts` - TailwindCSS styling
- `tsconfig.json` - TypeScript settings
- `components.json` - UI component configuration

## 📝 Development Guidelines

### TypeScript Best Practices
- Uses discriminated union types for file tree structures
- Implements explicit type checking
- Maintains clear interface definitions

### Component Architecture
- Modular component design with Radix UI primitives
- Consistent prop typing and interface definitions
- Clear separation of UI and logic layers

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

---

Built with Next.js and React for efficient codebase processing
