const socket = io();
const video = document.getElementById('remoteVideo');
const enterVR = document.getElementById('enterVR');

let pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

pc.ontrack = event => {
  video.srcObject = event.streams[0];
};

pc.onicecandidate = event => {
  if (event.candidate) {
    socket.emit('ice-candidate', event.candidate);
  }
};

socket.on('offer', async offer => {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  stream.getTracks().forEach(track => pc.addTrack(track, stream));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('answer', answer);
});

socket.on('answer', answer => {
  pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', candidate => {
  pc.addIceCandidate(new RTCIceCandidate(candidate));
});

(async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  stream.getTracks().forEach(track => pc.addTrack(track, stream));
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('offer', offer);
})();

enterVR.onclick = async () => {
  if (navigator.xr) {
    const session = await navigator.xr.requestSession('immersive-vr');
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const gl = canvas.getContext('webgl', { xrCompatible: true });

    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
    const refSpace = await session.requestReferenceSpace('local');

    function onXRFrame(t, frame) {
      session.requestAnimationFrame(onXRFrame);
      const pose = frame.getViewerPose(refSpace);
      // You can render the video to a WebGL texture here
    }

    session.requestAnimationFrame(onXRFrame);
  } else {
    alert("WebXR not supported.");
  }
};
