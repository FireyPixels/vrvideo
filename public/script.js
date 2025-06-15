const socket = io();
const video = document.getElementById('remoteVideo');
const enterVR = document.getElementById('enterVR');

let pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

pc.ontrack = event => {
  console.log('📺 Received remote track');
  const stream = event.streams[0];
  video.srcObject = stream;

  video.onloadedmetadata = () => {
    console.log('🎬 Video metadata loaded, playing stream');
    video.play();
  };
};

pc.onicecandidate = event => {
  if (event.candidate) {
    console.log('❄️ Sending ICE candidate');
    socket.emit('ice-candidate', event.candidate);
  }
};

socket.on('offer', async offer => {
  console.log('📡 Offer received');
  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    console.log('🎥 Access to camera granted (answer side)');
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  } catch (err) {
    console.error('🚫 Error accessing camera on answer side:', err);
  }

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  console.log('📡 Sending answer');
  socket.emit('answer', answer);
});

socket.on('answer', answer => {
  console.log('📡 Answer received');
  pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', candidate => {
  console.log('❄️ ICE candidate received');
  pc.addIceCandidate(new RTCIceCandidate(candidate));
});

(async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    console.log('🎥 Access to camera granted (offer side)');
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  } catch (err) {
    console.error('🚫 Error accessing camera on offer side:', err);
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  console.log('📡 Sending offer');
  socket.emit('offer', offer);
})();

enterVR.onclick = async () => {
  if (navigator.xr) {
    try {
      const session = await navigator.xr.requestSession('immersive-vr');
      console.log('🕶️ Entering immersive VR mode');
      const canvas = document.createElement('canvas');
      document.body.appendChild(canvas);
      const gl = canvas.getContext('webgl', { xrCompatible: true });

      session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
      const refSpace = await session.requestReferenceSpace('local');

      function onXRFrame(t, frame) {
        session.requestAnimationFrame(onXRFrame);
        const pose = frame.getViewerPose(refSpace);
        if (pose) {
          // Optional: custom WebGL rendering of video texture here
        }
      }

      session.requestAnimationFrame(onXRFrame);
    } catch (err) {
      console.error('🚫 Failed to enter VR mode:', err);
    }
  } else {
    alert("❌ WebXR not supported.");
  }
};
