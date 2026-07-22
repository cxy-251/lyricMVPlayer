import {
    _decorator,
    Component,
    Layers,
    Node,
    UITransform,
    view,
} from 'cc';
import { AppRoot } from '../core/AppRoot';

const { ccclass } = _decorator;

@ccclass('Bootstrap')
export class Bootstrap extends Component {
    private appRoot: AppRoot | null = null;
    private contentHost: Node | null = null;

    onLoad(): void {
        this.contentHost = this.createContentHost();
        this.appRoot = AppRoot.ensure();
        this.appRoot.attachHost(this.contentHost);
    }

    start(): void {
        void this.appRoot?.navigation.home().catch((error: unknown) => {
            console.error('[cocoslab] bootstrap failed', error);
        });
    }

    onDestroy(): void {
        if (this.appRoot && this.contentHost) {
            void this.appRoot.navigation.detachHost(this.contentHost);
        }

        this.contentHost = null;
        this.appRoot = null;
    }

    private createContentHost(): Node {
        const existing = this.node.getChildByName('ContentHost');
        const host = existing ?? new Node('ContentHost');

        host.layer = Layers.Enum.UI_2D;

        if (!existing) {
            this.node.addChild(host);
        }

        const size = view.getVisibleSize();
        const transform = host.getComponent(UITransform) ?? host.addComponent(UITransform);
        transform.setContentSize(size.width, size.height);

        return host;
    }
}
