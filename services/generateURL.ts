const CLOUD_NAME = "dqvujibkn"; 
const UPLOAD_PRESET = "ai-generated-images"; // Use the name from Step A

export const uploadGeminiToCloudinary = async (base64String) => {
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  // Create the form data
  const formData = new FormData();

  formData.append('file', `data:image/png;base64,${base64String}`);
  formData.append('upload_preset', UPLOAD_PRESET);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    
    if (data.secure_url) {
      console.log("Success! Permanent URL:", data.secure_url);
      return data.secure_url;
    } else {
      console.error("Upload error:", data.error.message);
    }
  } catch (err) {
    console.error("Network Error:", err);
  }
};