import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import audioService from '../services/audio';

interface VoiceButtonProps {
  onRecord: (audioBlob: Blob) => void;
  isRecording: boolean;
  onRecordingChange: (recording: boolean) => void;
  disabled?: boolean;
}

const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

const VoiceButtonContainer = styled.button<{ $isRecording: boolean; $disabled: boolean }>`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background-color: ${props => {
    if (props.$disabled) return props.theme.colors.textTertiary;
    if (props.$isRecording) return props.theme.colors.error;
    return props.theme.colors.primary;
  }};
  color: white;
  cursor: ${props => props.$disabled ? 'not-allowed' : 'pointer'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${props => props.theme.fontSize.lg};
  transition: ${props => props.theme.transitions.fast};
  animation: ${props => props.$isRecording ? pulse : 'none'} 1s infinite;

  &:hover {
    background-color: ${props => {
      if (props.$disabled) return props.theme.colors.textTertiary;
      if (props.$isRecording) return props.theme.colors.error;
      return props.theme.colors.primaryHover;
    }};
  }

  &:active {
    transform: scale(0.95);
  }
`;

const VoiceButton: React.FC<VoiceButtonProps> = ({
  onRecord,
  isRecording,
  onRecordingChange,
  disabled = false
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (audioService.isCurrentlyRecording()) {
        stopRecording();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setIsProcessing(true);
      await audioService.startRecording();
      onRecordingChange(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check your permissions.');
    } finally {
      setIsProcessing(false);
    }
  };

  const stopRecording = async () => {
    try {
      setIsProcessing(true);
      const audioBlob = await audioService.stopRecording();
      onRecord(audioBlob);
      onRecordingChange(false);
    } catch (error) {
      console.error('Error stopping recording:', error);
      onRecordingChange(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClick = async () => {
    if (disabled || isProcessing) return;
    
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const getButtonContent = () => {
    if (isProcessing) return '⏳';
    if (isRecording) return '⏹️';
    return '🎤';
  };

  const getButtonTitle = () => {
    if (isProcessing) return 'Processing...';
    if (isRecording) return 'Stop recording';
    return 'Start voice recording';
  };

  return (
    <VoiceButtonContainer
      onClick={handleClick}
      $isRecording={isRecording}
      $disabled={disabled || isProcessing}
      title={getButtonTitle()}
    >
      {getButtonContent()}
    </VoiceButtonContainer>
  );
};

export default VoiceButton;