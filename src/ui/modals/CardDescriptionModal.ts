import { App, Modal } from 'obsidian';
import { t } from '../../../i18n';

export class CardDescriptionModal extends Modal {
    private text: string;
    private onSave: (text: string) => void;
    private textarea: HTMLTextAreaElement;

    constructor(app: App, currentText: string, onSave: (text: string) => void) {
        super(app);
        this.text = currentText;
        this.onSave = onSave;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: t('cardDescription') });

        this.textarea = contentEl.createEl('textarea', {
            attr: {
                style: 'width: 100%; height: 200px; resize: vertical; margin-bottom: 1em;'
            }
        });
        this.textarea.value = this.text;

        const buttonContainer = contentEl.createDiv({
            attr: {
                style: 'display: flex; justify-content: flex-end; gap: 0.5em;'
            }
        });

        const saveButton = buttonContainer.createEl('button', { text: t('save'), attr: { class: 'mod-cta' } });
        saveButton.addEventListener('click', () => {
            this.onSave(this.textarea.value);
            this.close();
        });

        const cancelButton = buttonContainer.createEl('button', { text: t('cancel') });
        cancelButton.addEventListener('click', () => {
            this.close();
        });

        // Фокус на textarea при открытии
        this.textarea.focus();
        // Выделение всего текста описания
        this.textarea.select();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
