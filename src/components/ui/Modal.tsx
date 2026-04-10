import { Check, X } from "lucide-react";
import Button from "./Button.tsx";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, description, children }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div className="z-50 fixed left-0 top-0 items-center w-screen h-screen backdrop-blur-sm flex justify-center">
            <div className="w-125 max-w-[90vw] h-auto bg-bg-1 rounded-lg border border-border flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="w-full h-14 text-text font-medium text-lg py-3 px-4 flex flex-row items-center justify-between border-b border-border">
                    <p className="font-semibold">{title}</p>
                    <button
                        onClick={onClose}
                        className="text-text-2 hover:text-text transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {description && (
                    <div className="w-full text-text font-medium text-base px-4 py-4 border-b border-border">
                        {description}
                    </div>
                )}

                <div className="w-full flex flex-col gap-3 px-4 py-4">
                    {children}
                </div>
            </div>
        </div>
    );
}

interface ConfirmModalProps extends Omit<ModalProps, 'children'> {
    confirmText: string;
    onConfirm: () => void;
    confirmColor?: "red" | "blue" | "orange";
    cancelText?: string;
}

export function ConfirmModal({
    isOpen,
    onClose,
    title,
    description,
    confirmText,
    onConfirm,
    confirmColor = "blue",
    cancelText = "Cancel"
}: ConfirmModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} description={description}>
            <div className="flex flex-row gap-3 w-full">
                <Button onClick={onConfirm} color={confirmColor} className="flex-1">
                    <Check/>
                    <p>{confirmText}</p>
                </Button>
                {cancelText && (
                    <Button onClick={onClose} color="red" className="flex-1">
                        <X/>
                        <p>{cancelText}</p>
                    </Button>
                )}
            </div>
        </Modal>
    );
}
