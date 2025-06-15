const socket = io();
const video = document.getElementById('remoteVideo');
const enterVR = document.getElementById('enterVR');

let pc = new RTCPeerConnection({
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// 🟢 Send your mobile camera stream as early as possible
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    console.log("🎥 Camera access granted");
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    video.srcObject = stream;
    video.play();
  })
  .catch(err => {
    console.error("🚫 Could not access camera:", err);
    alert("Please allow camera access to stream video.");
  });

pc.ontrack = event => {
  console.log("📺 Receiving remote track...");
  const [remoteStream] = event.streams;
  video.srcObject = remoteStream;
};

pc.onicecandidate = event => {
  if (event.candidate) {
    socket.emit("ice-candidate", event.candidate);
  }
};

socket.on("offer", async offer => {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", answer);
});

socket.on("answer", answer => {
  pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("ice-candidate", candidate => {
  pc.addIceCandidate(new RTCIceCandidate(candidate));
});

// 🔁 Start WebRTC offer
socket.emit("ready");


// ✅ WebXR immersive rendering
enterVR.onclick = async () => {
  if (!navigator.xr) {
    alert("❌ WebXR not supported.");
    return;
  }

  try {
    const session = await navigator.xr.requestSession('immersive-vr');
    console.log('🕶️ Entered immersive VR mode');

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    canvas.style.display = 'none';
    const gl = canvas.getContext('webgl', { xrCompatible: true });

    const xrLayer = new XRWebGLLayer(session, gl);
    session.updateRenderState({ baseLayer: xrLayer });

    const refSpace = await session.requestReferenceSpace('local');

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const vert = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0, 1);
      }
    `;
    const frag = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_texture;
      void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord);
      }
    `;

    function createShader(type, src) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      return shader;
    }

    const vs = createShader(gl.VERTEX_SHADER, vert);
    const fs = createShader(gl.FRAGMENT_SHADER, frag);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    const texLoc = gl.getUniformLocation(program, 'u_texture');

    function onXRFrame(time, frame) {
      session.requestAnimationFrame(onXRFrame);
      const pose = frame.getViewerPose(refSpace);
      if (!pose) return;

      gl.bindTexture(gl.TEXTURE_2D, texture);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
      } catch (e) {
        console.warn("⚠️ Texture update skipped:", e);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, xrLayer.framebufferWidth, xrLayer.framebufferHeight);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    session.requestAnimationFrame(onXRFrame);
  } catch (err) {
    console.error('🚫 WebXR session error:', err);
  }
};
