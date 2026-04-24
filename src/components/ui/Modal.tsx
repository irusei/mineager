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
        <div className="z-50 fixed left-0 top-0 flex items-center justify-center w-screen h-screen backdrop-blur-sm bg-black/40">
            <div className="w-110 max-w-[90vw] bg-bg-2 rounded-xl border border-border overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <p className="font-semibold text-lg text-text">{title}</p>
                    <button
                        onClick={onClose}
                        className="text-text-2 hover:text-text transition-colors rounded-md hover:bg-border/40 p-1"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {description && (
                    <div className="px-5 py-4">
                        <p className="text-text text-sm leading-relaxed">{description}</p>
                    </div>
                )}

                <div className="flex justify-start gap-2 px-5 py-4 border-t border-border">
                    {children}
                </div>
            </div>
        </div>
    );
}

interface ConfirmModalProps extends Omit<ModalProps, 'children'> {
    confirmText: string;
    onConfirm: () => void;
    confirmColor?: "red" | "blue" | "primary";
    cancelText?: string;
}

export function ConfirmModal({
    isOpen,
    onClose,
    title,
    description,
    confirmText,
    onConfirm,
    confirmColor = "primary",
    cancelText = "Cancel"
}: ConfirmModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} description={description}>
            <Button onClick={onConfirm} color={confirmColor} className="px-4">
                <Check className={"w-4 h-4"}/>
                <span>{confirmText}</span>
            </Button>
            <Button onClick={onClose} color="red" className="px-4">
                <X className={"w-4 h-4"}/>
                <span>{cancelText}</span>
            </Button>
        </Modal>
    );
}
