class ConfigEditor {
    constructor() {
        this.socket = io();
        this.config = {};
        this.currentSection = 'bot';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupSocketHandlers();
        this.loadConfig();
        // Footer year
        const yearEl = document.getElementById('year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('href').substring(1);
                this.showSection(section);
            });
        });

        // Sidebar search filter
        const navSearch = document.getElementById('navSearch');
        if (navSearch) {
            navSearch.addEventListener('input', (e) => {
                const q = e.target.value.toLowerCase();
                document.querySelectorAll('.nav-link').forEach(link => {
                    const text = link.textContent.toLowerCase();
                    link.parentElement.style.display = text.includes(q) ? '' : 'none';
                });
            });
        }

        // Mobile menu toggle
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.querySelector('nav.w-80');
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                const isHidden = sidebar.classList.contains('hidden');
                if (isHidden) {
                    sidebar.classList.remove('hidden');
                } else {
                    sidebar.classList.add('hidden');
                }
            });
            // Start hidden on small screens
            if (window.innerWidth < 768) sidebar.classList.add('hidden');
            window.addEventListener('resize', () => {
                if (window.innerWidth >= 768) sidebar.classList.remove('hidden');
            });
        }

        // Header buttons
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveConfig());
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportConfig());
        const importBtn = document.getElementById('importBtn');
        if (importBtn) importBtn.addEventListener('click', () => this.showImportModal());
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) themeToggle.addEventListener('click', () => this.toggleTheme());
        const validateBtn = document.getElementById('validateBtn');
        if (validateBtn) validateBtn.addEventListener('click', () => this.validateConfig());

        // Form inputs
        document.querySelectorAll('input, select, textarea').forEach(input => {
            input.addEventListener('change', () => this.updateConfig());
        });

        // Import modal
        document.getElementById('importConfirm').addEventListener('click', () => this.importConfig());
        document.getElementById('importCancel').addEventListener('click', () => this.hideImportModal());
        document.querySelector('.close').addEventListener('click', () => this.hideImportModal());

        // Embed builder
        this.setupEmbedBuilder();

        // Volume slider
        const volumeSlider = document.getElementById('defaultVolume');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                document.getElementById('volumeDisplay').textContent = e.target.value + '%';
                this.updateConfig();
            });
        }
    }

    setupSocketHandlers() {
        let notifyTimeout = null;
        const notifyOnce = () => {
            if (notifyTimeout) clearTimeout(notifyTimeout);
            notifyTimeout = setTimeout(() => {
                this.clearToasts();
                this.showToast('Configuration updated', 'success');
            }, 200);
        };

        this.socket.on('configData', (config) => {
            this.config = config;
            this.populateForm();
        });

        this.socket.on('configUpdated', () => {
            notifyOnce();
            this.loadConfig();
        });

        this.socket.on('configBulkUpdate', () => {
            notifyOnce();
            this.loadConfig();
        });

        this.socket.on('configImported', (config) => {
            this.showToast('Configuration imported successfully', 'success');
            this.config = config;
            this.populateForm();
        });
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            this.config = await response.json();
            this.populateForm();
        } catch (error) {
            console.error('Error loading config:', error);
            this.showToast('Error loading configuration', 'error');
        }
    }

    populateForm() {
        // Bot settings
        this.setValue('botToken', this.config.bot?.token || '');
        this.setValue('botPrefix', this.config.bot?.prefix || '!');
        this.setValue('ownerId', this.config.bot?.ownerId || '');
        this.setValue('botStatus', this.config.bot?.status || 'online');
        this.setValue('activityType', this.config.bot?.activity?.type || 'WATCHING');
        this.setValue('activityName', this.config.bot?.activity?.name || 'Managing servers');

        // Moderation
        this.setChecked('moderationEnabled', this.config.modules?.moderation?.enabled || false);
        this.setChecked('autoModEnabled', this.config.modules?.moderation?.autoMod?.enabled || false);
        this.setChecked('spamProtection', this.config.modules?.moderation?.autoMod?.spamProtection || false);
        this.setChecked('capsFilter', this.config.modules?.moderation?.autoMod?.capsFilter || false);
        this.setChecked('linkFilter', this.config.modules?.moderation?.autoMod?.linkFilter || false);
        this.setChecked('profanityFilter', this.config.modules?.moderation?.autoMod?.profanityFilter || false);

        // Leveling
        this.setChecked('levelingEnabled', this.config.modules?.leveling?.enabled || false);
        this.setValue('messageXP', this.config.modules?.leveling?.messageXP || 15);
        this.setValue('voiceXP', this.config.modules?.leveling?.voiceXP || 10);
        this.setChecked('levelUpMessage', this.config.modules?.leveling?.levelUpMessage || false);
        this.setValue('levelUpChannel', this.config.modules?.leveling?.levelUpChannel || '');

        // Welcomer
        this.setChecked('welcomerEnabled', this.config.modules?.welcomer?.enabled || false);
        this.setValue('welcomeChannel', this.config.modules?.welcomer?.welcomeChannel || '');
        this.setValue('leaveChannel', this.config.modules?.welcomer?.leaveChannel || '');
        this.setValue('welcomeMessage', this.config.modules?.welcomer?.welcomeMessage || '');
        this.setValue('leaveMessage', this.config.modules?.welcomer?.leaveMessage || '');
        this.setChecked('welcomeCardEnabled', this.config.modules?.welcomer?.welcomeCard?.enabled || false);

        // Tickets
        this.setChecked('ticketsEnabled', this.config.modules?.tickets?.enabled || false);
        this.setValue('transcriptChannel', this.config.modules?.tickets?.transcriptChannel || '');
        this.setChecked('autoCloseEnabled', this.config.modules?.tickets?.autoClose?.enabled || false);
        this.setValue('autoCloseTime', this.config.modules?.tickets?.autoClose?.time || 24);

        // Polls
        this.setChecked('pollsEnabled', this.config.modules?.polls?.enabled || false);
        this.setValue('defaultDuration', this.config.modules?.polls?.defaultDuration || 24);
        this.setChecked('allowMultiple', this.config.modules?.polls?.allowMultiple || false);

        // Music
        this.setChecked('musicEnabled', this.config.modules?.music?.enabled || false);
        this.setValue('defaultVolume', this.config.modules?.music?.defaultVolume || 50);
        this.setValue('maxQueue', this.config.modules?.music?.maxQueue || 100);
        this.setValue('djRole', this.config.modules?.music?.djRole || '');

        // Social Media
        this.setChecked('socialEnabled', this.config.modules?.social?.enabled || false);
        this.setChecked('youtubeEnabled', this.config.modules?.social?.youtube?.enabled || false);
        this.setValue('youtubeChannel', this.config.modules?.social?.youtube?.channel || '');
        this.setChecked('twitterEnabled', this.config.modules?.social?.twitter?.enabled || false);
        this.setChecked('twitchEnabled', this.config.modules?.social?.twitch?.enabled || false);

        // Premium
        this.setChecked('premiumEnabled', this.config.modules?.premium?.enabled || false);
        this.setChecked('customStatus', this.config.modules?.premium?.features?.customStatus || false);
        this.setChecked('removeBranding', this.config.modules?.premium?.features?.removeBranding || false);
        this.setChecked('verification', this.config.modules?.premium?.features?.verification || false);
        this.setChecked('starboard', this.config.modules?.premium?.features?.starboard || false);
        this.setChecked('tempVoice', this.config.modules?.premium?.features?.tempVoice || false);
        this.setChecked('birthdays', this.config.modules?.premium?.features?.birthdays || false);

        // Update preview
        this.updatePreview();
    }

    setValue(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        }
    }

    setChecked(id, checked) {
        const element = document.getElementById(id);
        if (element) {
            element.checked = checked;
        }
    }

    showSection(section) {
        // Hide all sections
        document.querySelectorAll('.config-section').forEach(sec => {
            sec.classList.remove('active');
            sec.style.display = 'none';
        });

        // Remove active class from nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active', 'bg-discord-blurple', 'text-white');
            link.classList.add('text-discord-light');
        });

        // Show selected section
        const targetSection = document.getElementById(section);
        if (targetSection) {
            targetSection.classList.add('active');
            targetSection.style.display = 'block';
        }

        // Update nav link
        const navLink = document.querySelector(`[href="#${section}"]`);
        if (navLink) {
            navLink.classList.add('active', 'bg-discord-blurple', 'text-white');
            navLink.classList.remove('text-discord-light');
        }

        this.currentSection = section;

        // Update preview if on preview section
        if (section === 'preview') {
            this.updatePreview();
        }
    }

    updateConfig() {
        // Update config object based on current form values
        const updates = [];

        // Bot settings
        updates.push({ path: 'bot.token', value: document.getElementById('botToken').value });
        updates.push({ path: 'bot.prefix', value: document.getElementById('botPrefix').value });
        updates.push({ path: 'bot.ownerId', value: document.getElementById('ownerId').value });
        updates.push({ path: 'bot.status', value: document.getElementById('botStatus').value });
        updates.push({ path: 'bot.activity.type', value: document.getElementById('activityType').value });
        updates.push({ path: 'bot.activity.name', value: document.getElementById('activityName').value });

        // Moderation
        updates.push({ path: 'modules.moderation.enabled', value: document.getElementById('moderationEnabled').checked });
        updates.push({ path: 'modules.moderation.autoMod.enabled', value: document.getElementById('autoModEnabled').checked });
        updates.push({ path: 'modules.moderation.autoMod.spamProtection', value: document.getElementById('spamProtection').checked });
        updates.push({ path: 'modules.moderation.autoMod.capsFilter', value: document.getElementById('capsFilter').checked });
        updates.push({ path: 'modules.moderation.autoMod.linkFilter', value: document.getElementById('linkFilter').checked });
        updates.push({ path: 'modules.moderation.autoMod.profanityFilter', value: document.getElementById('profanityFilter').checked });

        // Leveling
        updates.push({ path: 'modules.leveling.enabled', value: document.getElementById('levelingEnabled').checked });
        updates.push({ path: 'modules.leveling.messageXP', value: parseInt(document.getElementById('messageXP').value) || 15 });
        updates.push({ path: 'modules.leveling.voiceXP', value: parseInt(document.getElementById('voiceXP').value) || 10 });
        updates.push({ path: 'modules.leveling.levelUpMessage', value: document.getElementById('levelUpMessage').checked });
        updates.push({ path: 'modules.leveling.levelUpChannel', value: document.getElementById('levelUpChannel').value });

        // Welcomer
        updates.push({ path: 'modules.welcomer.enabled', value: document.getElementById('welcomerEnabled').checked });
        updates.push({ path: 'modules.welcomer.welcomeChannel', value: document.getElementById('welcomeChannel').value });
        updates.push({ path: 'modules.welcomer.leaveChannel', value: document.getElementById('leaveChannel').value });
        updates.push({ path: 'modules.welcomer.welcomeMessage', value: document.getElementById('welcomeMessage').value });
        updates.push({ path: 'modules.welcomer.leaveMessage', value: document.getElementById('leaveMessage').value });
        updates.push({ path: 'modules.welcomer.welcomeCard.enabled', value: document.getElementById('welcomeCardEnabled').checked });

        // Tickets
        updates.push({ path: 'modules.tickets.enabled', value: document.getElementById('ticketsEnabled').checked });
        updates.push({ path: 'modules.tickets.transcriptChannel', value: document.getElementById('transcriptChannel').value });
        updates.push({ path: 'modules.tickets.autoClose.enabled', value: document.getElementById('autoCloseEnabled').checked });
        updates.push({ path: 'modules.tickets.autoClose.time', value: parseInt(document.getElementById('autoCloseTime').value) || 24 });

        // Polls
        updates.push({ path: 'modules.polls.enabled', value: document.getElementById('pollsEnabled').checked });
        updates.push({ path: 'modules.polls.defaultDuration', value: parseInt(document.getElementById('defaultDuration').value) || 24 });
        updates.push({ path: 'modules.polls.allowMultiple', value: document.getElementById('allowMultiple').checked });

        // Music
        updates.push({ path: 'modules.music.enabled', value: document.getElementById('musicEnabled').checked });
        updates.push({ path: 'modules.music.defaultVolume', value: parseInt(document.getElementById('defaultVolume').value) || 50 });
        updates.push({ path: 'modules.music.maxQueue', value: parseInt(document.getElementById('maxQueue').value) || 100 });
        updates.push({ path: 'modules.music.djRole', value: document.getElementById('djRole').value });

        // Social Media
        updates.push({ path: 'modules.social.enabled', value: document.getElementById('socialEnabled').checked });
        updates.push({ path: 'modules.social.youtube.enabled', value: document.getElementById('youtubeEnabled').checked });
        updates.push({ path: 'modules.social.youtube.channel', value: document.getElementById('youtubeChannel').value });
        updates.push({ path: 'modules.social.twitter.enabled', value: document.getElementById('twitterEnabled').checked });
        updates.push({ path: 'modules.social.twitch.enabled', value: document.getElementById('twitchEnabled').checked });

        // Premium
        updates.push({ path: 'modules.premium.enabled', value: document.getElementById('premiumEnabled').checked });
        updates.push({ path: 'modules.premium.features.customStatus', value: document.getElementById('customStatus').checked });
        updates.push({ path: 'modules.premium.features.removeBranding', value: document.getElementById('removeBranding').checked });
        updates.push({ path: 'modules.premium.features.verification', value: document.getElementById('verification').checked });
        updates.push({ path: 'modules.premium.features.starboard', value: document.getElementById('starboard').checked });
        updates.push({ path: 'modules.premium.features.tempVoice', value: document.getElementById('tempVoice').checked });
        updates.push({ path: 'modules.premium.features.birthdays', value: document.getElementById('birthdays').checked });

        // Send updates to server
        this.sendBulkUpdate(updates);
    }

    async sendBulkUpdate(updates) {
        try {
            const headers = { 'Content-Type': 'application/json' };
            const token = localStorage.getItem('adminToken');
            if (token) headers['x-admin-token'] = token;
            await fetch('/api/config/bulk', {
                method: 'POST',
                headers,
                body: JSON.stringify(updates)
            });
        } catch (error) {
            console.error('Error updating config:', error);
            this.showToast('Error updating configuration', 'error');
        }
    }

    async saveConfig() {
        this.updateConfig();
        this.showToast('Configuration saved successfully', 'success');
    }

    async exportConfig() {
        try {
            const headers = {};
            const token = localStorage.getItem('adminToken');
            if (token) headers['x-admin-token'] = token;
            const response = await fetch('/api/export', { headers });
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'config.yml';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error exporting config:', error);
            this.showToast('Error exporting configuration', 'error');
        }
    }

    showImportModal() {
        document.getElementById('importModal').style.display = 'block';
    }

    hideImportModal() {
        document.getElementById('importModal').style.display = 'none';
    }

    async importConfig() {
        const fileInput = document.getElementById('importFile');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showToast('Please select a file', 'warning');
            return;
        }

        try {
            const text = await file.text();
            const configData = file.name.endsWith('.json') ? JSON.parse(text) : this.parseYAML(text);
            
            const response = await fetch('/api/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ configData })
            });

            const result = await response.json();
            
            if (result.success) {
                this.hideImportModal();
                this.showToast('Configuration imported successfully', 'success');
            } else {
                this.showToast(`Import failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error importing config:', error);
            this.showToast('Error importing configuration', 'error');
        }
    }

    parseYAML(text) {
        // Simple YAML parser for basic config files
        // In a real implementation, you'd use a proper YAML parser
        return {};
    }

    toggleTheme() {
        const body = document.body;
        const themeIcon = document.getElementById('themeToggle').querySelector('i');
        
        if (body.classList.contains('light')) {
            body.classList.remove('light');
            body.classList.add('dark');
            themeIcon.className = 'fas fa-moon';
        } else {
            body.classList.remove('dark');
            body.classList.add('light');
            themeIcon.className = 'fas fa-sun';
        }
    }

    setupEmbedBuilder() {
        const embedInputs = ['embedTitle', 'embedDescription', 'embedColor', 'embedFooter'];
        
        embedInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', () => this.updateEmbedPreview());
            }
        });
    }

    updateEmbedPreview() {
        const title = document.getElementById('embedTitle').value;
        const description = document.getElementById('embedDescription').value;
        const color = document.getElementById('embedColor').value;
        const footer = document.getElementById('embedFooter').value;
        
        const preview = document.getElementById('embedPreview');
        preview.innerHTML = '';
        
        if (title || description || footer) {
            if (title) {
                const titleEl = document.createElement('div');
                titleEl.className = 'embed-title';
                titleEl.textContent = title;
                preview.appendChild(titleEl);
            }
            
            if (description) {
                const descEl = document.createElement('div');
                descEl.className = 'embed-description';
                descEl.textContent = description;
                preview.appendChild(descEl);
            }
            
            if (footer) {
                const footerEl = document.createElement('div');
                footerEl.className = 'embed-footer';
                footerEl.textContent = footer;
                preview.appendChild(footerEl);
            }
            
            preview.style.borderLeftColor = color;
        }
    }

    updatePreview() {
        const preview = document.getElementById('configPreview');
        if (preview) {
            preview.textContent = JSON.stringify(this.config, null, 2);
        }
    }

    async validateConfig() {
        try {
            const response = await fetch('/api/validate');
            const validation = await response.json();
            
            const resultsContainer = document.getElementById('validationResults');
            resultsContainer.innerHTML = '';
            
            if (validation.valid) {
                const successEl = document.createElement('div');
                successEl.className = 'validation-item success';
                successEl.innerHTML = '<i class="fas fa-check-circle"></i> Configuration is valid';
                resultsContainer.appendChild(successEl);
            } else {
                validation.errors.forEach(error => {
                    const errorEl = document.createElement('div');
                    errorEl.className = 'validation-item error';
                    errorEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${error}`;
                    resultsContainer.appendChild(errorEl);
                });
            }
        } catch (error) {
            console.error('Error validating config:', error);
            this.showToast('Error validating configuration', 'error');
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        this.clearToasts();
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 50);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    clearToasts() {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        Array.from(container.children).forEach((child) => child.remove());
    }
}

// Initialize the config editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ConfigEditor();
});
