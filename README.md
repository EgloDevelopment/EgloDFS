# EgloDFS

File storage based off of Discord _DO NOT USE THIS, BREAKS DISCORD TOS_

# Uploading

Send a POST request with the file attached, like so:

```
const formData = new FormData();
formData.append("file", file);

const response = await axios.post("http://your-server-ip:6969/upload", formData, {
    headers: {
    "Content-Type": "multipart/form-data",
    },
});
```

The server will return a status signal, a ID, and a time that it was uploaded, and the original filename

# Downloading

Send a GET request with the file_id in the URL, like so:

```
const response = await axios.get("http://your-server-ip:6969/download?file_id=your-file-id", {
    responseType: "blob",
});

// do something with the BLOB object
```
