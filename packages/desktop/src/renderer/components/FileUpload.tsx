import React, { useState } from 'react';
import styled from 'styled-components';

interface FileUploadProps {
  onFileSelect: (files: string[]) => void;
}

const FileUploadContainer = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.sm};
  align-items: center;
`;

const FileButton = styled.button`
  padding: ${props => props.theme.spacing.sm} ${props => props.theme.spacing.md};
  background-color: ${props => props.theme.colors.backgroundSecondary};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.md};
  font-size: ${props => props.theme.fontSize.sm};
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  transition: ${props => props.theme.transitions.fast};
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.xs};

  &:hover {
    background-color: ${props => props.theme.colors.surfaceHover};
  }
`;

const FileList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${props => props.theme.spacing.xs};
  max-width: 300px;
`;

const FileTag = styled.span`
  background-color: ${props => props.theme.colors.primary};
  color: white;
  padding: ${props => props.theme.spacing.xs} ${props => props.theme.spacing.sm};
  border-radius: ${props => props.theme.borderRadius.sm};
  font-size: ${props => props.theme.fontSize.xs};
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.xs};
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: ${props => props.theme.fontSize.xs};
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;

  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
`;

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const handleFileSelect = async () => {
    if (window.electronAPI) {
      try {
        const files = await window.electronAPI.selectFiles();
        if (files.length > 0) {
          const newFiles = [...selectedFiles, ...files];
          setSelectedFiles(newFiles);
          onFileSelect(newFiles);
        }
      } catch (error) {
        console.error('Error selecting files:', error);
      }
    }
  };

  const handleFolderSelect = async () => {
    if (window.electronAPI) {
      try {
        const folder = await window.electronAPI.selectFolder();
        if (folder) {
          const newFiles = [...selectedFiles, folder];
          setSelectedFiles(newFiles);
          onFileSelect(newFiles);
        }
      } catch (error) {
        console.error('Error selecting folder:', error);
      }
    }
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFileSelect(newFiles);
  };

  const getFileName = (filePath: string) => {
    return filePath.split(/[/\\]/).pop() || filePath;
  };

  return (
    <FileUploadContainer>
      <FileButton onClick={handleFileSelect}>
        📄 Add Files
      </FileButton>
      
      <FileButton onClick={handleFolderSelect}>
        📁 Add Folder
      </FileButton>

      {selectedFiles.length > 0 && (
        <FileList>
          {selectedFiles.map((file, index) => (
            <FileTag key={index}>
              {getFileName(file)}
              <RemoveButton onClick={() => removeFile(index)}>
                ×
              </RemoveButton>
            </FileTag>
          ))}
        </FileList>
      )}
    </FileUploadContainer>
  );
};

export default FileUpload;