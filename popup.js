
// document.addEventListener('DOMContentLoaded', async () => {
//     const statusDiv = document.getElementById('status');
//     const button = document.getElementById('extractButton');
//     const progressBar = document.getElementById('progressBar');
//     const downloadMessage = document.getElementById('downloadMessage');

//     // Restore UI state from local storage
//     chrome.storage.local.get(['status', 'progress', 'buttonDisabled', 'isProcessing'], (result) => {
//         if (result.status) statusDiv.textContent = result.status;
//         if (result.progress) progressBar.style.width = result.progress;
//         button.disabled = result.buttonDisabled || false;

//         if (result.isProcessing) {
//             button.disabled = true;
//             downloadMessage.style.display = 'block';
//         }
//     });

//     // Extract resumes on button click
//     button.addEventListener('click', async () => {
//         console.log('Extract button clicked');
//         button.disabled = true;
//         statusDiv.textContent = 'Processing...';
//         progressBar.style.width = '0%';
//         downloadMessage.style.display = 'block';

//         // Save state
//         chrome.storage.local.set({
//             status: 'Processing...',
//             progress: '0%',
//             buttonDisabled: true,
//             isProcessing: true,
//         });

//         try {
//             const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

//             if (!tab.url.includes('linkedin.com/hiring/jobs')) {
//                 statusDiv.textContent = 'Please navigate to LinkedIn Jobs page';
//                 button.disabled = false;
//                 downloadMessage.style.display = 'none';

//                 chrome.storage.local.set({
//                     status: 'Please navigate to LinkedIn Jobs page',
//                     buttonDisabled: false,
//                     isProcessing: false,
//                 });
//                 return;
//             }

//             const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract' });

//             if (response && response.success) {
//                 statusDiv.textContent = 'Processing... Please wait until all data is extracted.';
//                 chrome.storage.local.set({ status: 'Processing... Please wait until all data is extracted.' });
//             } else {
//                 statusDiv.textContent = response.error || 'An error occurred';
//                 button.disabled = false;
//                 downloadMessage.style.display = 'none';

//                 chrome.storage.local.set({
//                     status: response.error || 'An error occurred',
//                     buttonDisabled: false,
//                     isProcessing: false,
//                 });
//             }
//         } catch (error) {
//             console.log('Error:', error);
//             statusDiv.textContent = 'Error: ' + error.message;
//             button.disabled = false;
//             downloadMessage.style.display = 'none';

//             chrome.storage.local.set({
//                 status: 'Error: ' + error.message,
//                 buttonDisabled: false,
//                 isProcessing: false,
//             });
//         }
//     });

//     // Listen for messages from the background script
//     chrome.runtime.onMessage.addListener((message) => {
//         console.log('Received message in popup:', message);

//         if (message.type === "progressUpdate") {
//             const { currentPage, totalPages } = message.data;
//             const progress = (currentPage / totalPages) * 100;
//             progressBar.style.width = `${progress}%`;
//             statusDiv.textContent = `Processing page ${currentPage} of ${totalPages}`;

//             chrome.storage.local.set({
//                 status: `Processing page ${currentPage} of ${totalPages}`,
//                 progress: `${progress}%`,
//             });
//         } else if (message.type === "processApplications") {
//             console.log('Processing applications:', message.data);
//             const numApplications = message.data.values.length;
//             statusDiv.textContent = `Processing ${numApplications} applications...`;
//         } else if (message.success === true) {
//             // Handle successful Excel file creation
//             statusDiv.textContent = 'Data successfully exported! Check your downloads.';
//             progressBar.style.width = '100%';
//             button.disabled = false;
//             downloadMessage.style.display = 'none';

//             chrome.storage.local.set({
//                 status: 'Data successfully exported! Check your downloads.',
//                 progress: '100%',
//                 buttonDisabled: false,
//                 isProcessing: false
//             });
//         } else if (message.error) {
//             console.log('Error received:', message.error);
//             statusDiv.textContent = `Error: ${message.error}`;
//             button.disabled = false;
//             downloadMessage.style.display = 'none';

//             chrome.storage.local.set({
//                 status: `Error: ${message.error}`,
//                 buttonDisabled: false,
//                 isProcessing: false,
//             });
//         }
//     });
// });

document.addEventListener('DOMContentLoaded', async () => {
    const statusDiv = document.getElementById('status');
    const extractButton = document.getElementById('extractButton');
    const stopButton = document.getElementById('stopButton');
    const restartButton = document.getElementById('restartButton');
    const progressBar = document.getElementById('progressBar');
    const downloadMessage = document.getElementById('downloadMessage');

    let isProcessing = false;
    let stopProcessFlag = false;

    // Start extraction
    extractButton.addEventListener('click', async () => {
        console.log('Extract button clicked');
        isProcessing = true;
        stopProcessFlag = false;

        updateUIForProcessing();

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('linkedin.com/hiring/jobs')) {
                throw new Error('Please navigate to LinkedIn Jobs page');
            }

            await chrome.tabs.sendMessage(tab.id, { action: 'extract', restart: false });
        } catch (error) {
            handleError(error.message);
        }
    });

    // Stop extraction
    stopButton.addEventListener('click', () => {
        console.log('Stop button clicked');
        stopProcessFlag = true;
        isProcessing = false;

        updateUIForStopped();
    });

    // Restart extraction
    restartButton.addEventListener('click', async () => {
        console.log('Restart button clicked');
        isProcessing = true;
        stopProcessFlag = false;

        updateUIForProcessing();

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('linkedin.com/hiring/jobs')) {
                throw new Error('Please navigate to LinkedIn Jobs page');
            }

            await chrome.tabs.sendMessage(tab.id, { action: 'extract', restart: true });
        } catch (error) {
            handleError(error.message);
        }
    });

    // Update UI for processing
    function updateUIForProcessing() {
        extractButton.disabled = true;
        stopButton.disabled = false;
        restartButton.disabled = false;
        statusDiv.textContent = 'Processing...';
        progressBar.style.width = '0%';
        downloadMessage.style.display = 'block';
    }

    // Update UI for stopped process
    function updateUIForStopped() {
        stopButton.disabled = true;
        restartButton.disabled = false;
        extractButton.disabled = false;
        statusDiv.textContent = 'Process stopped';
        downloadMessage.style.display = 'none';
    }

    // Handle errors
    function handleError(message) {
        console.log('Error:', message);
        isProcessing = false;

        extractButton.disabled = false;
        stopButton.disabled = true;
        restartButton.disabled = true;
        statusDiv.textContent = `Error: ${message}`;
        downloadMessage.style.display = 'none';
    }

    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'progressUpdate') {
            const currentPage = message.data.currentPage;
            const totalPages = message.data.totalPages;
            const progress = (currentPage / totalPages) * 100;

            progressBar.style.width = `${progress}%`;
            statusDiv.textContent = `Processing page ${currentPage} of ${totalPages}`;
        } else if (message.success) {
            isProcessing = false;

            statusDiv.textContent = 'Data successfully exported! Check your downloads.';
            progressBar.style.width = '100%';
            extractButton.disabled = false;
            stopButton.disabled = true;
            restartButton.disabled = true;
            downloadMessage.style.display = 'none';
        } else if (message.error) {
            handleError(message.error);
        }
    });
});