
import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, Maximize, Minimize, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CallService, { CallType, CallParticipant } from "@/services/CallService";

interface VideoCallPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const VideoCallPanel: React.FC<VideoCallPanelProps> = ({ isOpen, onClose }) => {
  const [activeCall, setActiveCall] = useState<{
    id: string;
    type: CallType;
    participants: CallParticipant[];
    startTime: Date;
  } | null>(null);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState("00:00");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const callContainerRef = useRef<HTMLDivElement>(null);
  const durationIntervalRef = useRef<number | null>(null);
  
  useEffect(() => {
    const unsubscribe = CallService.onCallEvent((event) => {
      if (event.type === 'call_started') {
        setActiveCall(event.data);
        startDurationTimer(new Date());
      } else if (event.type === 'call_ended') {
        stopDurationTimer();
        onClose();
      } else if (event.type === 'participant_joined' || event.type === 'participant_left') {
        setActiveCall(CallService.getActiveCall());
      } else if (event.type === 'stream_updated') {
        setActiveCall(CallService.getActiveCall());
      } else if (event.type === 'media_status_changed') {
        setActiveCall(CallService.getActiveCall());
      }
    });
    
    // Initial state
    setActiveCall(CallService.getActiveCall());
    if (CallService.getActiveCall()) {
      startDurationTimer(CallService.getActiveCall()!.startTime);
    }
    
    return () => {
      unsubscribe();
      stopDurationTimer();
    };
  }, [onClose]);
  
  const startDurationTimer = (startTime: Date) => {
    stopDurationTimer();
    
    durationIntervalRef.current = window.setInterval(() => {
      const durationMs = new Date().getTime() - startTime.getTime();
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      setCallDuration(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
  };
  
  const stopDurationTimer = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  };
  
  const handleToggleAudio = () => {
    const newState = !localAudioEnabled;
    setLocalAudioEnabled(newState);
    CallService.toggleAudio(newState);
  };
  
  const handleToggleVideo = () => {
    const newState = !localVideoEnabled;
    setLocalVideoEnabled(newState);
    CallService.toggleVideo(newState);
  };
  
  const handleEndCall = () => {
    CallService.endCall();
  };
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      callContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  const renderParticipant = (participant: CallParticipant, isLarge = false) => {
    return (
      <div className={`relative rounded-lg overflow-hidden bg-gray-800 ${isLarge ? 'h-full' : 'h-32'}`}>
        {participant.stream && participant.videoEnabled ? (
          <video
            ref={el => {
              if (el && participant.stream) {
                el.srcObject = participant.stream;
              }
            }}
            autoPlay
            playsInline
            muted={participant.id === activeCall?.participants[0]?.id}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gray-800">
            <Avatar className={`${isLarge ? 'h-24 w-24' : 'h-16 w-16'}`}>
              <AvatarImage src={participant.avatar} />
              <AvatarFallback>{participant.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
        )}
        
        <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded-full text-white text-xs flex items-center">
          {!participant.audioEnabled && <MicOff size={12} className="mr-1 text-red-500" />}
          {!participant.videoEnabled && <VideoOff size={12} className="mr-1 text-red-500" />}
          <span>{participant.name}</span>
          {participant.id === activeCall?.participants[0]?.id && <span className="ml-1">(You)</span>}
        </div>
      </div>
    );
  };
  
  // If call is not active, don't render anything
  if (!isOpen || !activeCall) {
    return null;
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[90vw] h-[90vh] p-0 overflow-hidden" ref={callContainerRef}>
        <div className="flex flex-col h-full">
          {/* Call header */}
          <div className="bg-gray-900 p-3 flex items-center justify-between border-b border-gray-800">
            <div className="flex items-center">
              <Users size={18} className="text-primary mr-2" />
              <div>
                <h3 className="font-medium text-white">
                  {activeCall.type === 'video' ? 'Video Call' : 'Audio Call'} ({activeCall.participants.length})
                </h3>
                <p className="text-xs text-gray-400">{callDuration}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <Settings size={16} />
              </Button>
            </div>
          </div>
          
          {/* Call content */}
          <div className="flex-1 bg-gray-900 p-4 overflow-hidden">
            {activeCall.participants.length <= 2 ? (
              // 1-2 participants: One large video feed
              <div className="h-full flex flex-col">
                <div className="flex-1 relative">
                  {/* Main participant (the other person, or self if alone) */}
                  {renderParticipant(
                    activeCall.participants.length > 1
                      ? activeCall.participants.find(p => p.id !== activeCall.participants[0].id)!
                      : activeCall.participants[0],
                    true
                  )}
                  
                  {/* PiP for self view if 2 participants */}
                  {activeCall.participants.length > 1 && (
                    <div className="absolute bottom-4 right-4 w-48 rounded-lg overflow-hidden shadow-lg">
                      {renderParticipant(activeCall.participants[0])}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // 3+ participants: Grid layout
              <div className="h-full grid grid-cols-2 gap-4 overflow-auto">
                {activeCall.participants.map(participant => (
                  <div key={participant.id} className="aspect-video">
                    {renderParticipant(participant)}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Call controls */}
          <div className="bg-gray-900 p-4 border-t border-gray-800 flex items-center justify-center space-x-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-12 w-12 rounded-full ${
                      localAudioEnabled
                        ? 'bg-gray-800 hover:bg-gray-700 text-white'
                        : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                    }`}
                    onClick={handleToggleAudio}
                  >
                    {localAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{localAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-12 w-12 rounded-full ${
                      localVideoEnabled
                        ? 'bg-gray-800 hover:bg-gray-700 text-white'
                        : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                    }`}
                    onClick={handleToggleVideo}
                  >
                    {localVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{localVideoEnabled ? 'Turn off camera' : 'Turn on camera'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-full bg-red-500 hover:bg-red-600 text-white"
                    onClick={handleEndCall}
                  >
                    <PhoneOff size={20} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>End call</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoCallPanel;
