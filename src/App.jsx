import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

export default function App() {
  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', content: '¡Hola! ¿En qué puedo ayudarte hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const messagesEndRef = useRef(null);
  
  // Definir API_URL desde variable de entorno
  const API_URL = import.meta.env.VITE_API_URL;

  // Función para convertir markdown a JSX
  const parseMarkdown = (text) => {
    // Dividir por líneas para procesar listas
    const lines = text.split('\n');
    const elements = [];
    let listItems = [];
    let inList = false;
    let listType = null; // 'ul' o 'ol'

    lines.forEach((line, lineIndex) => {
      // Detectar items de lista con viñetas (-, *)
      const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
      // Detectar items de lista numerada (1., 2., etc.)
      const numberedMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
      
      if (bulletMatch) {
        // Si cambiamos de tipo de lista, cerrar la anterior
        if (inList && listType === 'ol') {
          elements.push(
            <ol key={`ol-${lineIndex}-close`} className="list-decimal my-2 ml-6">
              {listItems}
            </ol>
          );
          listItems = [];
        }
        
        inList = true;
        listType = 'ul';
        listItems.push(
          <li key={`list-${lineIndex}`} className="ml-4">
            {parseInlineMarkdown(line, bulletMatch[1])}
          </li>
        );
      } else if (numberedMatch) {
        // Si cambiamos de tipo de lista, cerrar la anterior
        if (inList && listType === 'ul') {
          elements.push(
            <ul key={`ul-${lineIndex}-close`} className="list-disc my-2 ml-6">
              {listItems}
            </ul>
          );
          listItems = [];
        }
        
        inList = true;
        listType = 'ol';
        listItems.push(
          <li key={`list-${lineIndex}`} className="ml-4">
            {parseInlineMarkdown(line, numberedMatch[1])}
          </li>
        );
      } else {
        // Si había una lista, cerrarla
        if (inList && listItems.length > 0) {
          if (listType === 'ol') {
            elements.push(
              <ol key={`ol-${lineIndex}`} className="list-decimal my-2 ml-6">
                {listItems}
              </ol>
            );
          } else {
            elements.push(
              <ul key={`ul-${lineIndex}`} className="list-disc my-2 ml-6">
                {listItems}
              </ul>
            );
          }
          listItems = [];
          inList = false;
          listType = null;
        }
        
        // Procesar línea normal
        if (line.trim()) {
          elements.push(
            <span key={`line-${lineIndex}`}>
              {parseInlineMarkdown(line, line)}
              {lineIndex < lines.length - 1 && <br />}
            </span>
          );
        } else if (lineIndex < lines.length - 1) {
          elements.push(<br key={`br-${lineIndex}`} />);
        }
      }
    });

    // Cerrar lista si termina con ella
    if (inList && listItems.length > 0) {
      if (listType === 'ol') {
        elements.push(
          <ol key="ol-final" className="list-decimal my-2 ml-6">
            {listItems}
          </ol>
        );
      } else {
        elements.push(
          <ul key="ul-final" className="list-disc my-2 ml-6">
            {listItems}
          </ul>
        );
      }
    }

    return elements;
  };

  // Función para procesar markdown inline (negrita, cursiva, código, enlaces)
  const parseInlineMarkdown = (fullLine, text) => {
    const elements = [];
    let remaining = text;
    let key = 0;

    // Regex para diferentes formatos
    const patterns = [
      { regex: /\*\*(.+?)\*\*/g, tag: 'strong' },           // **negrita**
      { regex: /\*(.+?)\*/g, tag: 'em' },                   // *cursiva*
      { regex: /_(.+?)_/g, tag: 'em' },                     // _cursiva_
      { regex: /`(.+?)`/g, tag: 'code' },                   // `código`
      { regex: /\[(.+?)\]\((.+?)\)/g, tag: 'link' }        // [texto](url)
    ];

    while (remaining.length > 0) {
      let earliestMatch = null;
      let earliestPattern = null;

      // Buscar el match más cercano
      patterns.forEach(pattern => {
        pattern.regex.lastIndex = 0;
        const match = pattern.regex.exec(remaining);
        if (match && (!earliestMatch || match.index < earliestMatch.index)) {
          earliestMatch = match;
          earliestPattern = pattern;
        }
      });

      if (!earliestMatch) {
        // No hay más matches, agregar el resto del texto
        elements.push(remaining);
        break;
      }

      // Agregar texto antes del match
      if (earliestMatch.index > 0) {
        elements.push(remaining.substring(0, earliestMatch.index));
      }

      // Agregar elemento formateado
      if (earliestPattern.tag === 'link') {
        elements.push(
          <a 
            key={key++} 
            href={earliestMatch[2]} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {earliestMatch[1]}
          </a>
        );
      } else if (earliestPattern.tag === 'code') {
        elements.push(
          <code 
            key={key++} 
            className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono"
          >
            {earliestMatch[1]}
          </code>
        );
      } else {
        const Tag = earliestPattern.tag;
        elements.push(<Tag key={key++}>{earliestMatch[1]}</Tag>);
      }

      // Actualizar texto restante
      remaining = remaining.substring(earliestMatch.index + earliestMatch[0].length);
    }

    return elements;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsTyping(true);

    try {
      // Validar que la URL del backend esté configurada
      if (!API_URL) {
        throw new Error('Backend URL not configured');
      }
      
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: currentInput,
          threadId: threadId
        })
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Guardar el threadId para mantener la conversación
      if (data.threadId && !threadId) {
        setThreadId(data.threadId);
      }
      
      const botMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.response || data.message
      };
      
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Lo siento, ocurrió un error al conectar con el servidor. Por favor, intenta nuevamente.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-800">Chat Asistente</h1>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-2xl px-4 py-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">
                  {parseMarkdown(message.content)}
                </p>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-800 border border-gray-200 px-4 py-3 rounded-lg">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end space-x-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu mensaje aquí..."
              className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="1"
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
