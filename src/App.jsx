import { useState, useEffect } from 'react';
import './App.css';
import { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableCell, TableRow, WidthType, VerticalAlign, AlignmentType, Indent, Header } from 'docx';
import { saveAs } from 'file-saver';


// Nombres que usaremos para guardar en la memoria del navegador
const DB_NAME = 'artProjectsDB';
const LAST_ACTIVE_PROJECT_KEY = 'lastActiveProject';

function App() {
  const [allProjects, setAllProjects] = useState(() => {
    try {
      const savedProjects = localStorage.getItem(DB_NAME);
      if (savedProjects) {
        return JSON.parse(savedProjects);
      }
    } catch (error) {
      console.error("Error al cargar proyectos desde localStorage:", error);
    }
    return { "Mi Primer Listado": [] };
  });

  const [activeProjectName, setActiveProjectName] = useState(() => {
    const lastActive = localStorage.getItem(LAST_ACTIVE_PROJECT_KEY);
    const savedProjectsRaw = localStorage.getItem(DB_NAME);
    const savedProjects = savedProjectsRaw ? JSON.parse(savedProjectsRaw) : null;

    if (lastActive && savedProjects && savedProjects[lastActive]) {
      return lastActive;
    }
    if (savedProjects && Object.keys(savedProjects).length > 0) {
      return Object.keys(savedProjects)[0];
    }
    return "Mi Primer Listado";
  });

  const [currentlyEditingId, setCurrentlyEditingId] = useState(null);
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem('artGeneratorSettings');
    const defaults = {
      officeName: '',
      location: '',
      date:`Caracas {FECHA}` ,
      title: 'Asignación de Obras de Arte',
      introText: `La Dirección de Patrimonio Cultural por medio de la presente, hace constar que las obras de arte pertenecientes a la Colección Permanente del MPPRE, detalladas a continuación se encuentran asignadas a la {OFICINA}, ubicada en el {UBICACION}.`,
      custodianName: 'Rhonal Lee Fonseca Alvarado',
      custodianTitle: 'Director General de la Oficina Estratégica de Seguimiento y Evaluación de Políticas Públicas',
      closingText: `El ciudadano {CUSTODIO_NOMBRE}, será el custodio de las obras mencionadas. Es fundamental resaltar que la Dirección de Patrimonio Cultural es la única autorizada para realizar cambios en las obras bajo su custodia. Estas piezas poseen un valor histórico cultural y su conservación es crucial para preservar nuestra memoria.`
    };
    const loadedSettings = savedSettings ? JSON.parse(savedSettings) : {};

    if (!loadedSettings.closingText) {
      loadedSettings.closingText = defaults.closingText;
    }

    return { ...defaults, ...loadedSettings };
  });
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const artworkList = allProjects[activeProjectName] || [];

  useEffect(() => {
    try {
      localStorage.setItem(DB_NAME, JSON.stringify(allProjects));
    } catch (error) {
      console.error("Error al guardar los proyectos:", error);
    }
  }, [allProjects]);

  useEffect(() => {
    if(activeProjectName) {
      localStorage.setItem(LAST_ACTIVE_PROJECT_KEY, activeProjectName);
    }
  }, [activeProjectName]);

  const handleCreateNewList = () => {
    const newName = window.prompt("Introduce el nombre para el nuevo listado:");
    if (newName && !allProjects[newName]) {
      setAllProjects(prev => ({ ...prev, [newName]: [] }));
      setActiveProjectName(newName);
    } else if (newName) {
      alert("Ya existe un listado con ese nombre.");
    }
  };

  const handleRenameList = () => {
    if (!activeProjectName) return;
    const newName = window.prompt(`Introduce el nuevo nombre para "${activeProjectName}":`, activeProjectName);
    if (newName && newName !== activeProjectName && !allProjects[newName]) {
      setAllProjects(prev => {
        const newProjects = { ...prev };
        newProjects[newName] = newProjects[activeProjectName];
        delete newProjects[activeProjectName];
        return newProjects;
      });
      setActiveProjectName(newName);
    } else if (newName) {
      alert("El nombre ya existe o no es válido.");
    }
  };

  const handleDeleteList = () => {
    if (!activeProjectName) return;
    if (window.confirm(`¿Estás seguro de que quieres eliminar el listado "${activeProjectName}"? Esta acción no se puede deshacer.`)) {
      const newProjects = { ...allProjects };
      delete newProjects[activeProjectName];
      setAllProjects(newProjects);
      setActiveProjectName(Object.keys(newProjects)[0] || '');
    }
  };

  const updateActiveProjectList = (newList) => {
    if (!activeProjectName) return;
    setAllProjects(prev => ({
      ...prev,
      [activeProjectName]: newList,
    }));
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();
    if (!activeProjectName) {
        alert("Por favor, crea o selecciona un listado antes de añadir una obra.");
        return;
    }
    const formData = new FormData(event.target);
    const imageFile = formData.get('image-upload');
    const processSubmit = (imageData) => {
      const artworkData = {
        assetNumber: formData.get('asset-number'),
        author: formData.get('author'),
        title: formData.get('title'),
        year: formData.get('year'),
        technique: formData.get('technique'),
        dimensions: formData.get('dimensions'),
        comments: formData.get('comments'),  // Añadido campo de comentarios
        
      };
      if (currentlyEditingId !== null) {
        const newList = artworkList.map(artwork =>
          artwork.id === currentlyEditingId
            ? { ...artwork, ...artworkData, imageData: imageData ?? artwork.imageData }
            : artwork
        );
        updateActiveProjectList(newList);
        setCurrentlyEditingId(null);
      } else {
        if (!imageData) {
          alert("Por favor, selecciona una imagen para la nueva obra.");
          return;
        }
        const newList = [...artworkList, { ...artworkData, id: Date.now(), imageData }];
        updateActiveProjectList(newList);
      }
      event.target.reset();
    };
    if (imageFile && imageFile.size > 0) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedImageData = canvas.toDataURL('image/jpeg', 0.7);
          processSubmit(compressedImageData);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(imageFile);
    } else {
      processSubmit(null);
    }
  };

  useEffect(() => {
    const cameraInput = document.getElementById('camera-upload');
    const handleCameraChange = (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const compressedImageData = canvas.toDataURL('image/jpeg', 0.7);
            const artworkData = {
              assetNumber: document.getElementById('asset-number').value,
              author: document.getElementById('author').value,
              title: document.getElementById('title').value,
              year: document.getElementById('year').value,
              technique: document.getElementById('technique').value,
              dimensions: document.getElementById('dimensions').value,
              comments: document.getElementById('comments').value, // Añadido campo de comentarios
            };
            if (currentlyEditingId !== null) {
              const newList = artworkList.map(artwork =>
                artwork.id === currentlyEditingId
                  ? { ...artwork, ...artworkData, imageData: compressedImageData ?? artwork.imageData }
                  : artwork
              );
              updateActiveProjectList(newList);
              setCurrentlyEditingId(null);
            } else {
              const newList = [...artworkList, { ...artworkData, id: Date.now(), imageData: compressedImageData }];
              updateActiveProjectList(newList);
            }
            document.getElementById('artwork-form').reset();
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    };

    cameraInput.addEventListener('change', handleCameraChange);

    return () => {
      cameraInput.removeEventListener('change', handleCameraChange);
    };
  }, [artworkList, currentlyEditingId, updateActiveProjectList]);

  const startEditing = (artwork) => {
    setCurrentlyEditingId(artwork.id);
    const form = document.getElementById('artwork-form');
    form.elements['asset-number'].value = artwork.assetNumber;
    form.elements['author'].value = artwork.author;
    form.elements['title'].value = artwork.title;
    form.elements['year'].value = artwork.year;
    form.elements['technique'].value = artwork.technique;
    form.elements['dimensions'].value = artwork.dimensions;
    form.elements['comments'].value = artwork.comments; // Añadido campo de comentarios
    form.scrollIntoView({ behavior: 'smooth' });
  };

  const deleteArtwork = (artworkId) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar esta obra?")) {
      const newList = artworkList.filter(artwork => artwork.id !== artworkId);
      updateActiveProjectList(newList);
    }
  };

  const clearAll = () => {
      if (!activeProjectName) return;
      if (window.confirm(`¿Estás seguro de que deseas vaciar el listado actual "${activeProjectName}"?`)) {
          updateActiveProjectList([]);
          setCurrentlyEditingId(null);
          document.getElementById('artwork-form').reset();
      }
  };

  const generateDocument = async () => {
    if (!artworkList || artworkList.length === 0) {
      alert("No hay obras en el listado actual para generar el documento.");
      return;
    }

    const includeIntro = window.confirm("¿Deseas incluir el texto introductorio en el documento?");

    // Cargar el logo
    let logoBuffer;
    try {
      const response = await fetch('/logo.jpg');
      if (!response.ok) throw new Error('Network response was not ok');
      logoBuffer = await response.arrayBuffer();
    } catch (error) {
      console.error("Error al cargar el logo:", error);
      alert("No se pudo cargar el logo para el documento. Por favor, verifica que 'public/logo.jpg' exista.");
      return;
    }


    const base64ToBuffer = (base64) => {
        const binaryString = window.atob(base64.split(',')[1]);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    };

    const FONT_FAMILY = "Arial";
    const FONT_SIZE = 12 * 2;

    const docChildren = [];

    if (includeIntro) {
      const today = new Date();
      const formattedDate = `${today.getDate()} de ${today.toLocaleString('es-ES', { month: 'long' })} de ${today.getFullYear()}`;

      // Fecha alineada a la derecha
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: settings.date.replace('{FECHA}', formattedDate),
              font: FONT_FAMILY,
              size: FONT_SIZE,
            }),
          ],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 100 },
        })
      );

      // Título centrado y en negrita
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: settings.title,
              bold: true,
              font: FONT_FAMILY,
              size: FONT_SIZE + 6, // Aumentar el tamaño de fuente para el título
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );

      const fullIntro = `${settings.introText}`
        .replace('{OFICINA}', settings.officeName)
        .replace('{UBICACION}', settings.location);

      fullIntro.split('\n').forEach(line => {
        docChildren.push(new Paragraph({ text: line, style: "JustifiedPara" }));
      });
      docChildren.push(new Paragraph(""));
    }

    artworkList.forEach(artwork => {
      const imageBuffer = base64ToBuffer(artwork.imageData);
      const IMAGE_WIDTH = 150;
      const IMAGE_HEIGHT = 100;
      const table = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { top: { style: "nil" }, bottom: { style: "nil" }, left: { style: "nil" }, right: { style: "nil" }, insideHorizontal: { style: "nil" }, insideVertical: { style: "nil" } },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 55, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({ children: [new TextRun({ text: artwork.assetNumber, font: FONT_FAMILY, size: FONT_SIZE })] }),
                    new Paragraph({ children: [new TextRun({ text: artwork.author, bold: true, font: FONT_FAMILY, size: FONT_SIZE })] }),
                    new Paragraph({ children: [new TextRun({ text: artwork.title, italics: true, font: FONT_FAMILY, size: FONT_SIZE })] }),
                    new Paragraph({ children: [new TextRun({ text: artwork.year, font: FONT_FAMILY, size: FONT_SIZE })] }),
                    new Paragraph({ children: [new TextRun({ text: artwork.technique, font: FONT_FAMILY, size: FONT_SIZE })] }),
                    new Paragraph({ children: [new TextRun({ text: artwork.dimensions, font: FONT_FAMILY, size: FONT_SIZE })] }),
                    new Paragraph({ children: [new TextRun({ text: artwork.comments, font: FONT_FAMILY, size: FONT_SIZE })] }), // Añadido campo de comentarios
                ],
              }),
              new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                children: [ new Paragraph({ children: [ new ImageRun({ data: imageBuffer, transformation: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT } }) ] }) ],
              }),
            ],
          }),
        ],
      });
      docChildren.push(table);
      docChildren.push(new Paragraph(""));
    });

    if (includeIntro) {
      if (settings.closingText && settings.closingText.trim() !== '') {
        const closing = settings.closingText.replace('{CUSTODIO_NOMBRE}', settings.custodianName);
        closing.split('\n').forEach(line => {
          docChildren.push(new Paragraph({ text: line, style: "JustifiedPara" }));
        });
      }

      docChildren.push(new Paragraph(""));
      docChildren.push(new Paragraph({ text: "Suscriben la presente:", style: "SignaturePara" }));
      docChildren.push(new Paragraph(""));
      docChildren.push(new Paragraph(""));
      docChildren.push(new Paragraph(""));
      docChildren.push(new Paragraph(""));
      docChildren.push(new Paragraph(""));
    
      docChildren.push(new Paragraph("")); // Espacio antes de las firmas

      docChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: { style: "nil" }, bottom: { style: "nil" }, left: { style: "nil" }, right: { style: "nil" }, insideHorizontal: { style: "nil" }, insideVertical: { style: "nil" } },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({ text: "Arq. Juan Tablante", style: "SignaturePara", alignment: AlignmentType.LEFT }),
                    new Paragraph({ text: "Director de Patrimonio", style: "SignaturePara", alignment: AlignmentType.LEFT }),
                  ],
                  borders: {},
                }),
                new TableCell({
                  children: [
                    new Paragraph({ text: settings.custodianName, style: "SignaturePara", alignment: AlignmentType.RIGHT }),
                    new Paragraph({ text: settings.custodianTitle, style: "SignaturePara", alignment: AlignmentType.RIGHT }),
                  ],
                  borders: {},
                }),
              ],
            }),
          ],
        })
      );
    }

    const doc = new Document({
      styles: {
        paragraphStyles: [
          {
            id: "JustifiedPara",
            name: "Justified Para",
            basedOn: "Normal",
            next: "Normal",
            run: { font: { name: FONT_FAMILY }, size: FONT_SIZE },
            paragraph: { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 700 } },
          },
          {
            id: "SignaturePara",
            name: "Signature Para",
            basedOn: "Normal",
            next: "Normal",
            run: { font: { name: FONT_FAMILY }, size: FONT_SIZE },
          }
        ],
      },
      sections: [{
        headers: {
            default: new Header({
                children: [
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: logoBuffer,
                                transformation: {
                                    width: 314,
                                    height: 48,
                                },
                            }),
                        ],
                        alignment: AlignmentType.LEFT,
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Oficina de Servicios Administrativos",
                                font: FONT_FAMILY,
                                size: 14,
                                bold: true,
                            }),
                        ],
                        alignment: AlignmentType.LEFT,
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Dirección de Patrimonio Cultural",
                                font: FONT_FAMILY,
                                size: 14,
                                bold: true,
                            }),
                        ],
                        alignment: AlignmentType.LEFT,
                    }),
                ],
            }),
        },
        children: docChildren,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "ListadoDeObras.docx");
  };

  return (
    <>
      <header>
        <h1>Generador de Listados de Arte 🎨</h1>
      </header>
      <main className="container">
        <div className="form-container">
          <h2>{currentlyEditingId ? 'Editando Obra' : 'Añadir Nueva Obra'}</h2>
          <form id="artwork-form" onSubmit={handleFormSubmit}>
            <label htmlFor="asset-number">Nro. de Bien:</label>
            <input type="text" id="asset-number" name="asset-number" required />
            <label htmlFor="author">Autor:</label>
            <input type="text" id="author" name="author" required />
            <label htmlFor="title">Título:</label>
            <input type="text" id="title" name="title" required />
            <label htmlFor="year">Fecha:</label>
            <input type="text" id="year" name="year" />
            <label htmlFor="technique">Técnica:</label>
            <input type="text" id="technique" name="technique" />
            <label htmlFor="dimensions">Medidas:</label>
            <input type="text" id="dimensions" name="dimensions" />
            <label htmlFor="comments">Comentarios:</label>
            <textarea id="comments" name="comments" rows="4"></textarea>
            <p className="note">Nota: Puedes subir una imagen de la obra o tomar una foto con la cámara.</p>
            <label htmlFor="image-upload">Fotografía de la Obra:</label>
            <input type="file" id="image-upload" name="image-upload" accept="image/*" />
            <input type="file" id="camera-upload" name="camera-upload" accept="image/*" capture="environment" style={{display: 'none'}} />
            
              <button type="button" onClick={() => document.getElementById('camera-upload').click()} className="btn btn-secondary">Tomar Foto</button>
              <button type="submit" className={`btn ${currentlyEditingId ? 'btn-update' : 'btn-add'}`}>
                {currentlyEditingId ? 'Actualizar Obra' : 'Agregar Obra a la Lista'}
              </button>
            
          </form>
        </div>
        <div className="list-container">
          <div className="project-manager">
            <select value={activeProjectName} onChange={(e) => setActiveProjectName(e.target.value)}>
              {Object.keys(allProjects).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <div className="project-actions">
              <button onClick={handleCreateNewList}>Nuevo</button>
              <button onClick={handleRenameList} disabled={!activeProjectName}>Renombrar</button>
              <button onClick={handleDeleteList} disabled={!activeProjectName}>Eliminar</button>
              <button onClick={() => setIsSettingsModalOpen(true)}>Configuración</button>
            </div>
          </div>
          <div className="list-header">
            <h2>{activeProjectName || 'Sin listado seleccionado'}</h2>
            <div className="action-buttons">
              <button onClick={generateDocument} className="btn btn-generate">Generar Documento Word</button>
              <button onClick={clearAll} className="btn btn-clear">Limpiar Lista Actual</button>
            </div>
          </div>
          <div id="artwork-list">
            {artworkList.length === 0 ? (
              <p>Aún no has añadido ninguna obra.</p>
            ) : (
              artworkList.map(artwork => (
                <div key={artwork.id} className="artwork-item">
                  <img src={artwork.imageData} alt={artwork.title} className="artwork-thumbnail" />
                  <div className="artwork-info">
                    <p><strong>Autor:</strong> {artwork.author}</p>
                    <p><strong>Título:</strong> {artwork.title}</p>
                  </div>
                  <div className="item-actions">
                    <button onClick={() => startEditing(artwork)} className="btn-edit">Editar</button>
                    <button onClick={() => deleteArtwork(artwork.id)} className="btn-delete">Eliminar</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {isSettingsModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Configuración de Documento</h2>
            <label htmlFor="officeName">Nombre de la Oficina:</label>
            <input
              type="text"
              id="officeName"
              value={settings.officeName}
              onChange={(e) => setSettings({ ...settings, officeName: e.target.value })}
            />
            <label htmlFor="location">Ubicación:</label>
            <input
              type="text"
              id="location"
              value={settings.location}
              onChange={(e) => setSettings({ ...settings, location: e.target.value })}
            />
            <label htmlFor="date">Fecha:</label>
            <input
              type="text"
              id="date"
              value={settings.date}
              onChange={(e) => setSettings({ ...settings, date: e.target.value })}
            />
            <label htmlFor="title">Título:</label>
            <input
              type="text"
              id="title"
              value={settings.title}
              onChange={(e) => setSettings({ ...settings, title: e.target.value })}
            />
            <label htmlFor="custodianName">Nombre del Custodio:</label>
            <input
              type="text"
              id="custodianName"
              value={settings.custodianName}
              onChange={(e) => setSettings({ ...settings, custodianName: e.target.value })}
            />
            <label htmlFor="custodianTitle">Cargo del Custodio:</label>
            <input
              type="text"
              id="custodianTitle"
              value={settings.custodianTitle}
              onChange={(e) => setSettings({ ...settings, custodianTitle: e.target.value })}
            />
            <label htmlFor="introText">Texto Introductorio:</label>
            <textarea
              id="introText"
              rows="10"
              value={settings.introText}
              onChange={(e) => setSettings({ ...settings, introText: e.target.value })}
            ></textarea>
            <label htmlFor="closingText">Texto de Cierre:</label>
            <textarea
              id="closingText"
              rows="10"
              value={settings.closingText}
              onChange={(e) => setSettings({ ...settings, closingText: e.target.value })}
            ></textarea>
            <div className="modal-actions">
              <button onClick={() => {
                localStorage.setItem('artGeneratorSettings', JSON.stringify(settings));
                setIsSettingsModalOpen(false);
              }}>Guardar</button>
              <button onClick={() => setIsSettingsModalOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
