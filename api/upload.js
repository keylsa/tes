const { Octokit } = require('@octokit/rest');
const JSZip = require('jszip');
const multiparty = require('multiparty');
const fs = require('fs');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Parse FormData
        const form = new multiparty.Form();
        
        const formData = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) {
                    console.error('Form parse error:', err);
                    reject(err);
                }
                resolve({ fields, files });
            });
        });

        const { fields, files } = formData;
        
        const repo = fields.repo?.[0];
        const path = fields.path?.[0] || '';
        const commitMessage = fields.commitMessage?.[0] || 'Upload files via GitHub Uploader';
        const autoExtract = fields.autoExtract?.[0] === 'true';
        const token = fields.token?.[0];

        // Dapatkan base URL dari request
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        console.log('Upload request:', { repo, path, autoExtract, filesCount: files.files?.length, baseUrl });

        if (!token) {
            return res.status(401).json({ error: 'No authentication token provided' });
        }

        if (!repo) {
            return res.status(400).json({ error: 'Repository name is required' });
        }

        if (repo.includes('/')) {
            return res.status(400).json({ error: 'Repository name cannot contain "/". Enter only the repository name.' });
        }

        // Initialize Octokit
        const octokit = new Octokit({ 
            auth: token,
            request: {
                timeout: 30000
            }
        });

        // Dapatkan username dari token
        let username;
        try {
            const { data: user } = await octokit.users.getAuthenticated();
            username = user.login;
            console.log('Authenticated as:', username);
        } catch (error) {
            console.error('Failed to get user:', error);
            return res.status(401).json({ error: 'Invalid token or unable to get user info' });
        }

        // Format repository: username/repo-name
        const fullRepo = `${username}/${repo}`;

        // Check repo access
        let repoExists = true;
        try {
            await octokit.repos.get({ 
                owner: username, 
                repo: repo
            });
            console.log('Repository exists:', fullRepo);
        } catch (error) {
            if (error.status === 404) {
                repoExists = false;
                console.log('Repository does not exist, will create:', fullRepo);
            } else {
                console.error('Error checking repo:', error);
                throw error;
            }
        }

        // Buat repository jika belum ada
        if (!repoExists) {
            try {
                const currentDate = new Date().toLocaleDateString('id-ID', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                });

                const currentYear = new Date().getFullYear();

                // Description yang berisi semua teks dari README
                const repoDescription = `📦 Repository: ${repo} | 👤 Author: @branpedia | ⚡ Created via GitHub Uploader | 📅 ${currentDate} | 📝 Repository created automatically via GitHub Uploader | 🔰 Author: Branpedia | 💻 Developer: Bran | 🚀 Project: GitHub Uploader | 🌐 Website: branpediaid.vercel.app | 📚 API Docs: Coming Soon | © ${currentYear} Branpedia`;

                await octokit.repos.createForAuthenticatedUser({
                    name: repo,
                    private: false,
                    auto_init: true,
                    description: repoDescription
                });
                console.log('Repository created successfully');

                // README.md sesuai permintaan (dengan HTML)
                const readmeContent = `<div align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=28&duration=3000&pause=1000&color=2F81F7&center=true&vCenter=true&width=500&lines=%F0%9F%93%81+Repository+%3A+${repo};%F0%9F%91%A4+Author+%3A+%40branpedia;%F0%9F%9A%80+Created+via+GitHub+Uploader" alt="Typing SVG" />
</div>

<br>

<p align="center">
  <img src="https://img.shields.io/badge/Repository-${repo}-2F81F7?style=for-the-badge&logo=github" />
  <img src="https://img.shields.io/badge/Author-%40branpedia-2F81F7?style=for-the-badge&logo=github" />
</p>

<br>

## 📋 Repository Information

<div align="center">
  <table>
    <tr>
      <td align="right" width="150"><strong>📦 Repository Name</strong></td>
      <td><code>${repo}</code></td>
    </tr>
    <tr>
      <td align="right"><strong>👤 Author</strong></td>
      <td><a href="https://github.com/branpedia">@branpedia</a></td>
    </tr>
    <tr>
      <td align="right"><strong>⚡ Created Via</strong></td>
      <td><a href="https://branpediaid.vercel.app">GitHub Uploader</a></td>
    </tr>
    <tr>
      <td align="right"><strong>📅 Created Date</strong></td>
      <td>${currentDate}</td>
    </tr>
    <tr>
      <td align="right"><strong>📝 Description</strong></td>
      <td>Repository created automatically via GitHub Uploader</td>
    </tr>
  </table>
</div>

<br>

## 👨‍💻 Author Details

<div align="center">
  <table>
    <tr>
      <td align="center" width="200">
        <img src="https://github.com/branpedia.png" width="100" height="100" style="border-radius: 50%; border: 3px solid #2F81F7" />
        <br>
        <strong>@branpedia</strong>
      </td>
      <td>
        <table>
          <tr>
            <td align="right"><strong>🔰 Author</strong></td>
            <td>Branpedia</td>
          </tr>
          <tr>
            <td align="right"><strong>💻 Developer</strong></td>
            <td>Bran</td>
          </tr>
          <tr>
            <td align="right"><strong>🚀 Project</strong></td>
            <td>GitHub Uploader</td>
          </tr>
          <tr>
            <td align="right"><strong>🌐 Website</strong></td>
            <td><a href="https://branpediaid.vercel.app">branpediaid.vercel.app</a></td>
          </tr>
          <tr>
            <td align="right"><strong>📚 API Docs</strong></td>
            <td><em>Coming Soon</em></td>
          </tr>
          <tr>
            <td align="right"><strong>© Copyright</strong></td>
            <td>© ${currentYear} Branpedia</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>

<br>`;

                // Upload README.md
                await octokit.repos.createOrUpdateFileContents({
                    owner: username,
                    repo: repo,
                    path: 'README.md',
                    message: 'Add README.md',
                    content: Buffer.from(readmeContent).toString('base64')
                });
                
                console.log('README.md uploaded successfully');
                
            } catch (error) {
                console.error('Failed to create repository or update README:', error);
                // Tetap lanjutkan meskipun gagal update README
            }
        }

        const uploadResults = [];
        const fileList = files.files || [];
        const historyItems = [];

        if (fileList.length === 0) {
            return res.status(400).json({ error: 'No files selected for upload' });
        }

        console.log(`Processing ${fileList.length} files...`);

        // Proses setiap file
        for (const file of fileList) {
            try {
                const fileBuffer = fs.readFileSync(file.path);
                const fileSize = fileBuffer.length;
                const isZip = file.originalFilename.toLowerCase().endsWith('.zip');
                
                console.log(`Processing file: ${file.originalFilename} (${fileSize} bytes, isZip: ${isZip})`);

                // Handle ZIP files with auto-extract
                if (isZip && autoExtract) {
                    console.log(`Extracting ZIP: ${file.originalFilename}`);
                    const zipFiles = await extractZip(file);
                    
                    for (const zipFile of zipFiles) {
                        try {
                            await uploadFileToGitHub(
                                octokit,
                                username,
                                repo,
                                path,
                                zipFile.name,
                                zipFile.content,
                                commitMessage
                            );
                            
                            uploadResults.push({
                                name: zipFile.name,
                                status: 'success',
                                type: 'extracted',
                                size: zipFile.content.length
                            });

                            historyItems.push({
                                id: Date.now() + Math.random(),
                                name: zipFile.name,
                                repo: fullRepo,
                                status: 'success',
                                timestamp: new Date().toISOString(),
                                type: 'extracted',
                                size: zipFile.content.length,
                                user: username
                            });
                            
                            console.log(`Extracted file uploaded: ${zipFile.name}`);
                        } catch (error) {
                            console.error(`Failed to upload extracted file ${zipFile.name}:`, error);
                            uploadResults.push({
                                name: zipFile.name,
                                status: 'error',
                                error: error.message,
                                type: 'extracted'
                            });

                            historyItems.push({
                                id: Date.now() + Math.random(),
                                name: zipFile.name,
                                repo: fullRepo,
                                status: 'error',
                                timestamp: new Date().toISOString(),
                                type: 'extracted',
                                error: error.message,
                                user: username
                            });
                        }
                    }
                    
                    uploadResults.push({
                        name: `${file.originalFilename} (${zipFiles.length} files extracted)`,
                        status: 'success',
                        type: 'zip'
                    });
                    
                } else {
                    // Upload regular file (any type)
                    await uploadFileToGitHub(
                        octokit,
                        username,
                        repo,
                        path,
                        file.originalFilename,
                        fileBuffer,
                        commitMessage
                    );
                    
                    uploadResults.push({
                        name: file.originalFilename,
                        status: 'success',
                        type: 'file',
                        size: fileSize
                    });

                    historyItems.push({
                        id: Date.now() + Math.random(),
                        name: file.originalFilename,
                        repo: fullRepo,
                        status: 'success',
                        timestamp: new Date().toISOString(),
                        type: 'file',
                        size: fileSize,
                        user: username
                    });
                    
                    console.log(`File uploaded successfully: ${file.originalFilename}`);
                }

                // Clean up temp file
                fs.unlinkSync(file.path);

            } catch (error) {
                console.error(`Error uploading ${file.originalFilename}:`, error);
                uploadResults.push({
                    name: file.originalFilename,
                    status: 'error',
                    error: error.message,
                    type: 'file'
                });

                historyItems.push({
                    id: Date.now() + Math.random(),
                    name: file.originalFilename,
                    repo: fullRepo,
                    status: 'error',
                    timestamp: new Date().toISOString(),
                    type: 'file',
                    error: error.message,
                    user: username
                });
            }
        }

        const successfulUploads = uploadResults.filter(r => r.status === 'success');
        const failedUploads = uploadResults.filter(r => r.status === 'error');

        console.log(`Upload complete. Success: ${successfulUploads.length}, Failed: ${failedUploads.length}`);

        // Return data lengkap termasuk history items
        return res.status(200).json({
            success: successfulUploads.length > 0,
            message: successfulUploads.length > 0 
                ? `Successfully uploaded ${successfulUploads.length} files${!repoExists ? ' (new repository created)' : ''}` 
                : 'Upload failed',
            files: uploadResults,
            successfulCount: successfulUploads.length,
            failedCount: failedUploads.length,
            history: historyItems,
            repo: fullRepo,
            username: username
        });

    } catch (error) {
        console.error('Upload error:', error);
        
        if (error.status === 401) {
            return res.status(401).json({ 
                error: 'Authentication failed',
                details: 'The provided token is invalid or expired'
            });
        }
        
        if (error.status === 403) {
            return res.status(403).json({ 
                error: 'Rate limit exceeded',
                details: 'GitHub API rate limit exceeded. Please try again later.'
            });
        }

        return res.status(500).json({ 
            error: 'Upload failed',
            details: error.message
        });
    }
};

async function extractZip(zipFile) {
    try {
        const zip = new JSZip();
        const fileBuffer = fs.readFileSync(zipFile.path);
        const zipData = await zip.loadAsync(fileBuffer);
        
        const files = [];
        
        for (const [filename, file] of Object.entries(zipData.files)) {
            if (!file.dir) {
                const content = await file.async('nodebuffer');
                files.push({
                    name: filename,
                    content: content
                });
            }
        }
        
        return files;
    } catch (error) {
        throw new Error(`Failed to extract ZIP file: ${error.message}`);
    }
}

async function uploadFileToGitHub(octokit, owner, repo, basePath, filename, content, commitMessage) {
    const cleanFilename = filename.replace(/^\/+/, '').replace(/\/+/g, '/');
    const cleanBasePath = basePath.replace(/\/+$/, '').replace(/\/+/g, '/');
    const fullPath = cleanBasePath ? `${cleanBasePath}/${cleanFilename}` : cleanFilename;
    
    try {
        let sha;
        try {
            const existingFile = await octokit.repos.getContent({
                owner,
                repo,
                path: fullPath
            });
            sha = existingFile.data.sha;
        } catch (error) {
            sha = undefined;
        }

        const response = await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: fullPath,
            message: commitMessage,
            content: content.toString('base64'),
            sha: sha
        });

        return {
            success: true,
            url: response.data.content.html_url
        };

    } catch (error) {
        if (error.status === 409) {
            throw new Error(`File conflict: ${filename} already exists`);
        }
        if (error.status === 422) {
            throw new Error(`Validation failed for ${filename}. The file may be too large.`);
        }
        throw new Error(`Failed to upload ${filename}: ${error.message}`);
    }
}
