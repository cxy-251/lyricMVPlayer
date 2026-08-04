export interface AppSnapshot {
    readonly activeModuleId: string;
    readonly activeModuleTitle: string;
    readonly appVisible: boolean;
    readonly lastError: string | null;
}

type AppStateListener = (snapshot: AppSnapshot) => void;

export class AppState {
    private snapshot: AppSnapshot = {
        activeModuleId: 'boot',
        activeModuleTitle: 'Cocos Lab',
        appVisible: true,
        lastError: null,
    };

    private readonly listeners = new Set<AppStateListener>();

    get current(): AppSnapshot {
        return this.snapshot;
    }

    subscribe(listener: AppStateListener, emitImmediately = true): () => void {
        this.listeners.add(listener);

        try {
            if (emitImmediately) {
                listener(this.snapshot);
            }
        } catch (error) {
            this.listeners.delete(listener);
            throw error;
        }

        let active = true;
        return () => {
            if (!active) {
                return;
            }
            active = false;
            this.listeners.delete(listener);
        };
    }

    setActiveModule(id: string, title: string): void {
        this.patch({
            activeModuleId: id,
            activeModuleTitle: title,
            lastError: null,
        });
    }

    setVisible(visible: boolean): void {
        this.patch({ appVisible: visible });
    }

    setError(error: unknown): void {
        const message = error instanceof Error ? error.message : String(error);
        this.patch({ lastError: message });
    }

    clearError(): void {
        if (this.snapshot.lastError !== null) {
            this.patch({ lastError: null });
        }
    }

    private patch(patch: Partial<AppSnapshot>): void {
        const next = { ...this.snapshot, ...patch };

        if (
            next.activeModuleId === this.snapshot.activeModuleId
            && next.activeModuleTitle === this.snapshot.activeModuleTitle
            && next.appVisible === this.snapshot.appVisible
            && next.lastError === this.snapshot.lastError
        ) {
            return;
        }

        this.snapshot = next;

        for (const listener of [...this.listeners]) {
            listener(this.snapshot);
        }
    }
}
