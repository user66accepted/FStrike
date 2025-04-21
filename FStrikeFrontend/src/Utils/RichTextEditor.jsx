import React, { useState, useRef, useEffect } from "react";
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaStrikethrough,
  FaUndo,
  FaRedo,
  FaListOl,
  FaListUl,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaLink,
  FaUnlink,
  FaCut,
  FaCopy,
  FaClipboard,
  FaImage,
  FaTable,
  FaQuoteLeft,
  FaExpand,
  FaCompress,
  FaCode,
  FaMagic,
  FaEraser,
  FaOutdent,
  FaIndent,
  FaAnchor,
  FaMinus,
  FaFileAlt,
  FaRegSmile,
  FaBorderStyle,
  FaEye
} from "react-icons/fa";
import { MdFormatColorText, MdFormatColorFill } from "react-icons/md";

const RichTextEditor = ({ value, onChange }) => {
  const textareaRef = useRef(null);
  const iframeRef = useRef(null);
  const [editorContent, setEditorContent] = useState(value || "");
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showBlocks, setShowBlocks] = useState(false);

  // Update content when external value changes.
  useEffect(() => {
    setEditorContent(value || "");
  }, [value]);

  // When in iframe mode, update its document when editorContent changes.
  useEffect(() => {
    if (!isSourceMode && iframeRef.current) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
      doc.open();
      doc.write(editorContent);
      doc.close();
      // Enable design mode for editing.
      doc.designMode = "on";
      // Attach input listener to capture changes.
      doc.body.oninput = handleInput;
    }
  }, [editorContent, isSourceMode]);

  // Handle content changes from iframe (WYSIWYG mode) or textarea (source mode).
  const handleInput = () => {
    if (!isSourceMode && iframeRef.current) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
      const content = doc.body.innerHTML;
      setEditorContent(content);
      onChange(content);
    } else if (isSourceMode && textareaRef.current) {
      const content = textareaRef.current.value;
      setEditorContent(content);
      onChange(content);
    }
  };

  // Execute command on the appropriate document.
  const execCommand = (command, arg = null) => {
    let targetDoc;
    if (!isSourceMode && iframeRef.current) {
      targetDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document;
    } else {
      // For source mode, use the main document on the textarea.
      targetDoc = document;
    }
    targetDoc.execCommand(command, false, arg);
    handleInput();
  };

  // Command helpers.
  const insertLink = () => {
    const url = prompt("Enter the URL", "http://");
    if (url) {
      execCommand("createLink", url);
    }
  };

  const insertImage = () => {
    const url = prompt("Enter the image URL", "http://");
    if (url) {
      execCommand("insertImage", url);
    }
  };

  const insertTable = () => {
    const rows = prompt("Number of rows", "2");
    const cols = prompt("Number of columns", "2");
    if (rows && cols) {
      let tableHTML = '<table border="1" style="border-collapse: collapse; width: 100%;">';
      for (let i = 0; i < parseInt(rows, 10); i++) {
        tableHTML += "<tr>";
        for (let j = 0; j < parseInt(cols, 10); j++) {
          tableHTML += "<td style='padding: 4px;'>&nbsp;</td>";
        }
        tableHTML += "</tr>";
      }
      tableHTML += "</table>";
      execCommand("insertHTML", tableHTML);
    }
  };

  const insertHorizontalRule = () => {
    execCommand("insertHorizontalRule");
  };

  const insertSpecialChar = () => {
    const char = prompt("Enter a special character (or copy one from here: © ® ™)", "©");
    if (char) {
      execCommand("insertText", char);
    }
  };

  const insertPageBreak = () => {
    const pageBreakHTML = '<hr style="page-break-after: always; border: none;"/>';
    execCommand("insertHTML", pageBreakHTML);
  };

  // Toggle between WYSIWYG (iframe) and source (textarea) mode.
  const toggleSourceMode = () => {
    if (isSourceMode && textareaRef.current) {
      // Leaving source mode: update content from textarea.
      setEditorContent(textareaRef.current.value);
    }
    setIsSourceMode(!isSourceMode);
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  const toggleShowBlocks = () => {
    setShowBlocks(!showBlocks);
  };

  // Dropdown handlers.
  const handleFormatChange = (e) => {
    const format = e.target.value;
    execCommand("formatBlock", format);
  };

  const handleFontChange = (e) => {
    const font = e.target.value;
    execCommand("fontName", font);
  };

  const handleFontSizeChange = (e) => {
    const size = e.target.value;
    execCommand("fontSize", size);
  };

  const handleTextColorChange = (e) => {
    const color = e.target.value;
    execCommand("foreColor", color);
  };

  const handleBGColorChange = (e) => {
    const color = e.target.value;
    execCommand("hiliteColor", color);
  };

  const pastePlainText = () => {
    const text = prompt("Paste plain text here:");
    if (text) {
      execCommand("insertText", text);
    }
  };

  const pasteFromWord = () => {
    const text = prompt("Paste content from Word here:");
    if (text) {
      const plainText = text.replace(/<\/?[^>]+(>|$)/g, "");
      execCommand("insertText", plainText);
    }
  };

  return (
    <div
      className={`rich-text-editor p-2 border rounded ${isMaximized ? "fixed top-0 left-0 right-0 bottom-0 bg-white z-50" : ""} ${showBlocks ? "show-blocks" : ""}`}
    >
      {/* Toolbar */}
      <div className="toolbar flex flex-wrap space-x-2 mb-2">
        <button type="button" onClick={toggleSourceMode} title="Source" className="p-2 rounded hover:bg-gray-200 transition">
          <FaCode />
        </button>
        <button type="button" onClick={() => alert("Preview:\n" + editorContent)} title="Preview" className="p-2 rounded hover:bg-gray-200 transition">
          <FaEye />
        </button>
        <button
          type="button"
          onClick={() => {
            const template = prompt("Enter template HTML:");
            if (template) {
              execCommand("insertHTML", template);
            }
          }}
          title="Templates"
          className="p-2 rounded hover:bg-gray-200 transition"
        >
          <FaMagic />
        </button>
        <button type="button" onClick={() => execCommand("cut")} title="Cut" className="p-2 rounded hover:bg-gray-200 transition">
          <FaCut />
        </button>
        <button type="button" onClick={() => execCommand("copy")} title="Copy" className="p-2 rounded hover:bg-gray-200 transition">
          <FaCopy />
        </button>
        <button type="button" onClick={pastePlainText} title="Paste as Plain Text" className="p-2 rounded hover:bg-gray-200 transition">
          <FaClipboard />
        </button>
        <button type="button" onClick={pasteFromWord} title="Paste from Word" className="p-2 rounded hover:bg-gray-200 transition">
          <FaClipboard />
        </button>
        <button type="button" onClick={() => execCommand("undo")} title="Undo" className="p-2 rounded hover:bg-gray-200 transition">
          <FaUndo />
        </button>
        <button type="button" onClick={() => execCommand("redo")} title="Redo" className="p-2 rounded hover:bg-gray-200 transition">
          <FaRedo />
        </button>
        <button type="button" onClick={() => execCommand("bold")} title="Bold" className="p-2 rounded hover:bg-gray-200 transition">
          <FaBold />
        </button>
        <button type="button" onClick={() => execCommand("italic")} title="Italic" className="p-2 rounded hover:bg-gray-200 transition">
          <FaItalic />
        </button>
        <button type="button" onClick={() => execCommand("underline")} title="Underline" className="p-2 rounded hover:bg-gray-200 transition">
          <FaUnderline />
        </button>
        <button type="button" onClick={() => execCommand("strikeThrough")} title="Strikethrough" className="p-2 rounded hover:bg-gray-200 transition">
          <FaStrikethrough />
        </button>
        <button type="button" onClick={() => execCommand("subscript")} title="Subscript" className="p-2 rounded hover:bg-gray-200 transition">
          <span style={{ fontSize: "0.8em" }}>
            X<sub>2</sub>
          </span>
        </button>
        <button type="button" onClick={() => execCommand("superscript")} title="Superscript" className="p-2 rounded hover:bg-gray-200 transition">
          <span style={{ fontSize: "0.8em" }}>
            X<sup>2</sup>
          </span>
        </button>
        <button type="button" onClick={() => execCommand("removeFormat")} title="Remove Format" className="p-2 rounded hover:bg-gray-200 transition">
          <FaEraser />
        </button>
        <button type="button" onClick={() => execCommand("insertOrderedList")} title="Ordered List" className="p-2 rounded hover:bg-gray-200 transition">
          <FaListOl />
        </button>
        <button type="button" onClick={() => execCommand("insertUnorderedList")} title="Unordered List" className="p-2 rounded hover:bg-gray-200 transition">
          <FaListUl />
        </button>
        <button type="button" onClick={() => execCommand("outdent")} title="Outdent" className="p-2 rounded hover:bg-gray-200 transition">
          <FaOutdent />
        </button>
        <button type="button" onClick={() => execCommand("indent")} title="Indent" className="p-2 rounded hover:bg-gray-200 transition">
          <FaIndent />
        </button>
        <button type="button" onClick={() => execCommand("formatBlock", "<blockquote>")} title="Blockquote" className="p-2 rounded hover:bg-gray-200 transition">
          <FaQuoteLeft />
        </button>
        <button type="button" onClick={() => execCommand("justifyLeft")} title="Align Left" className="p-2 rounded hover:bg-gray-200 transition">
          <FaAlignLeft />
        </button>
        <button type="button" onClick={() => execCommand("justifyCenter")} title="Align Center" className="p-2 rounded hover:bg-gray-200 transition">
          <FaAlignCenter />
        </button>
        <button type="button" onClick={() => execCommand("justifyRight")} title="Align Right" className="p-2 rounded hover:bg-gray-200 transition">
          <FaAlignRight />
        </button>
        <button type="button" onClick={() => execCommand("justifyFull")} title="Justify" className="p-2 rounded hover:bg-gray-200 transition">
          <FaBorderStyle />
        </button>
        <button type="button" onClick={insertLink} title="Insert Link" className="p-2 rounded hover:bg-gray-200 transition">
          <FaLink />
        </button>
        <button type="button" onClick={() => execCommand("unlink")} title="Remove Link" className="p-2 rounded hover:bg-gray-200 transition">
          <FaUnlink />
        </button>
        <button
          type="button"
          onClick={() => {
            const anchorName = prompt("Enter anchor name:", "anchor");
            if (anchorName) {
              execCommand("insertHTML", `<a name="${anchorName}"></a>`);
            }
          }}
          title="Insert Anchor"
          className="p-2 rounded hover:bg-gray-200 transition"
        >
          <FaAnchor />
        </button>
        <button type="button" onClick={insertImage} title="Insert Image" className="p-2 rounded hover:bg-gray-200 transition">
          <FaImage />
        </button>
        <button type="button" onClick={insertTable} title="Insert Table" className="p-2 rounded hover:bg-gray-200 transition">
          <FaTable />
        </button>
        <button type="button" onClick={insertHorizontalRule} title="Insert Horizontal Rule" className="p-2 rounded hover:bg-gray-200 transition">
          <FaMinus />
        </button>
        <button type="button" onClick={insertSpecialChar} title="Insert Special Character" className="p-2 rounded hover:bg-gray-200 transition">
          <FaRegSmile />
        </button>
        <button type="button" onClick={insertPageBreak} title="Insert Page Break" className="p-2 rounded hover:bg-gray-200 transition">
          <FaFileAlt />
        </button>
        <select onChange={handleFormatChange} defaultValue="" className="p-2 rounded border border-gray-300">
          <option value="" disabled>
            Format
          </option>
          <option value="P">Paragraph</option>
          <option value="H1">Heading 1</option>
          <option value="H2">Heading 2</option>
          <option value="H3">Heading 3</option>
          <option value="H4">Heading 4</option>
          <option value="H5">Heading 5</option>
          <option value="H6">Heading 6</option>
        </select>
        <select onChange={handleFontChange} defaultValue="" className="p-2 rounded border border-gray-300">
          <option value="" disabled>
            Font
          </option>
          <option value="Arial">Arial</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Verdana">Verdana</option>
        </select>
        <select onChange={handleFontSizeChange} defaultValue="" className="p-2 rounded border border-gray-300">
          <option value="" disabled>
            Font Size
          </option>
          <option value="1">1 (small)</option>
          <option value="2">2</option>
          <option value="3">3 (normal)</option>
          <option value="4">4</option>
          <option value="5">5 (large)</option>
          <option value="6">6</option>
          <option value="7">7 (huge)</option>
        </select>
        <input type="color" onChange={handleTextColorChange} title="Text Color" className="p-1 rounded border border-gray-300" />
        <input type="color" onChange={handleBGColorChange} title="Background Color" className="p-1 rounded border border-gray-300" />
        <button type="button" onClick={toggleMaximize} title="Maximize Editor" className="p-2 rounded hover:bg-gray-200 transition">
          {isMaximized ? <FaCompress /> : <FaExpand />}
        </button>
        <button type="button" onClick={toggleShowBlocks} title="Show Blocks" className="p-2 rounded hover:bg-gray-200 transition">
          <FaBorderStyle />
        </button>
      </div>
      {/* Editor Area */}
      {isSourceMode ? (
        <textarea
          ref={textareaRef}
          defaultValue={editorContent}
          onInput={handleInput}
          className="w-full border border-gray-300 rounded-md p-2 overflow-auto"
          style={{ minHeight: "400px", maxHeight: "410px", resize: "none" }}
        />
      ) : (
        <iframe
          ref={iframeRef}
          title="Rich Text Editor"
          style={{
            width: "100%",
            minHeight: "400px",
            maxHeight: "410px",
            border: "none",
            overflow: "auto"
          }}
        />
      )}
      {/* Inline CSS to constrain inner elements */}
      <style jsx>{`
        .rich-text-editor img,
        .rich-text-editor table,
        .rich-text-editor iframe,
        .rich-text-editor pre {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
