
import { EntityOrderBy, FindOptions, remult as defaultRemult, Remult, Repository, RestDataProviderHttpProvider, Sort } from '../../index';
import { v4 as uuid } from 'uuid';
import { RestEntityDataProvider } from '../data-providers/rest-data-provider';
import { Action } from '../server-action';
import { RepositoryImplementation } from '../remult3';
import { Allowed, buildRestDataProvider } from '../context';
import { ServerEventDispatcher } from './LiveQueryPublisher';
import { getId } from '../remult3/getId';

export const streamUrl = 'stream1';
class LiveQuerySubscriber<entityType> {
    id: string;
    subscribeCode: () => void;
    async setAllItems(result: any[]) {
        const items = await Promise.all(result.map(item => this.repo.fromJson(item)));
        this.forListeners(listener => {
            listener(x => {
                return items;
            });
        });
    }


    forListeners(what: (listener: (((reducer: (prevState: entityType[]) => entityType[]) => void))) => void) {
        //   what(x => this.defaultQueryState = x(this.defaultQueryState));
        for (const l of this.listeners) {
            what(l)
        }
    }

    async handle(message: liveQueryMessage) {


        const sort = (items: entityType[]) => {

            if (this.query.orderBy) {
                const o = Sort.translateOrderByToSort(this.repo.metadata, this.query.orderBy);
                items.sort((a: any, b: any) => o.compare(a, b));
            }
            return items;
        }

        switch (message.type) {
            case "all":
                this.setAllItems(message.data);
                break;
            case "replace": {
                const item = await this.repo.fromJson(message.data.item);
                this.forListeners(listener => {
                    listener(items => {
                        if (!items)
                            items = [];
                        return sort(items.map(x => getId(this.repo.metadata, x) === message.data.oldId ? item : x));
                    });
                });
                break;
            }
            case "add":
                {
                    const item = await this.repo.fromJson(message.data.item);
                    this.forListeners(listener =>
                        listener(items => {
                            if (!items)
                                items = [];
                            items = items.filter(x => getId(this.repo.metadata, x) !== getId(this.repo.metadata, item));
                            items.push(item);
                            return sort(items);
                        }));
                    break;
                }
            case "remove":
                this.forListeners(listener =>
                    listener(items => {
                        if (!items)
                            items = [];
                        return items.filter(x => getId(this.repo.metadata, x) !== message.data.id);
                    }));
                break;
        };
    }

    defaultQueryState: entityType[] = [];
    listeners: (((reducer: (prevState: entityType[]) => entityType[]) => void))[] = [];
    constructor(private repo: Repository<entityType>, private query: SubscribeToQueryArgs<entityType>) { }

}


export interface LiveQueryProvider {
    openStreamAndReturnCloseFunction(clientId: string, onMessage: MessageHandler, onReconnect: VoidFunction): Promise<VoidFunction>;

}


class MessageChannel<T> {
    id: string;
    async handle(message: T) {
        for (const l of this.listeners) {
            l(message);
        }
    }

    listeners: ((items: T) => void)[] = [];
    constructor() { }

}


export type MessageHandler = (message: { data: any, event: string }) => void;

export class LiveQueryClient {

    clientId = uuid();
    private queries = new Map<string, LiveQuerySubscriber<any>>();
    private channels = new Map<string, MessageChannel<any>>();
    constructor(public lqp: LiveQueryProvider, private provider?: RestDataProviderHttpProvider) {
    }
    runPromise(p: Promise<any>) {
        return p;
    }
    close() {
        this.queries.clear();
        this.channels.clear();
        this.closeIfNoListeners();
    }
    subscribeChannel<T>(key: string, onResult: (item: T) => void) {

        let onUnsubscribe: VoidFunction = () => { };
        this.openIfNoOpened().then(() => {

            let q = this.channels.get(key);
            if (!q) {
                this.channels.set(key, q = new MessageChannel());
                this.provider.post(defaultRemult.apiClient.url + '/' + streamUrl, {
                    channel: key,
                    clientId: this.clientId,
                    remove: false
                } as ChannelSubscribe);
            }
            else {
            }
            q.listeners.push(onResult);
            onUnsubscribe = () => {
                q.listeners.splice(q.listeners.indexOf(onResult), 1);
                if (q.listeners.length == 0) {
                    this.channels.delete(key);
                }
                this.closeIfNoListeners();
            }
        });

        return () => {
            onUnsubscribe();
        }

    }

    private closeIfNoListeners() {
        if (this.queries.size === 0 && this.channels.size === 0) {
            this.runPromise(this.closeListener.then(x => x()));
            this.closeListener = undefined;
        }
    }

    subscribe<entityType>(
        repo: Repository<entityType>,
        options: FindOptions<entityType>,
        onResult: (reducer: (prevState: entityType[]) => entityType[]) => void) {

        let alive = true;
        let onUnsubscribe: VoidFunction = () => { };

        this.runPromise(this.openIfNoOpened().then(() => (repo as RepositoryImplementation<entityType>).buildEntityDataProviderFindOptions(options)
            .then(opts => {
                if (!alive)
                    return;

                const { url, filterObject } = new RestEntityDataProvider(() => defaultRemult.apiClient.url + '/' + repo.metadata.key, () => this.provider!, repo.metadata)
                    .buildFindRequest(opts);

                const eventTypeKey = JSON.stringify({ url, filterObject });
                let q = this.queries.get(eventTypeKey);
                if (!q) {
                    this.queries.set(eventTypeKey, q = new LiveQuerySubscriber(repo, { entityKey: repo.metadata.key, orderBy: options.orderBy }));
                    url.add("__action", 'subscribe|' + this.clientId);
                    q.subscribeCode = () => {
                        const thenResult = (r: SubscribeResult) => {
                            this.runPromise(q.setAllItems(r.result));
                            q.id = r.id;
                        }
                        if (filterObject) {
                            this.runPromise(this.provider.post(url.url, filterObject).then(thenResult));
                        }
                        else
                            this.runPromise(this.provider.get(url.url).then(thenResult));
                    };
                    q.subscribeCode();
                }
                else {
                    onResult(x => [...q.defaultQueryState]);
                }
                q.listeners.push(onResult);
                onUnsubscribe = () => {
                    q.listeners.splice(q.listeners.indexOf(onResult), 1);
                    if (q.listeners.length == 0) {
                        this.queries.delete(eventTypeKey);
                        this.provider.post(defaultRemult.apiClient.url + '/' + streamUrl, {
                            channel: q.id,
                            clientId: this.clientId,
                            remove: false
                        } as ChannelSubscribe);
                    }
                    this.closeIfNoListeners();
                }
            })));

        return () => {
            alive = false;
            onUnsubscribe();
        }

    }
    closeListener: Promise<VoidFunction>;

    private openIfNoOpened() {
        if (!this.provider) {
            this.provider = buildRestDataProvider(defaultRemult.apiClient.httpClient);
        }
        if (!this.closeListener)
            return this.runPromise(this.closeListener =
                this.lqp.openStreamAndReturnCloseFunction(this.clientId, message => {
                    for (const q of this.queries.values()) {
                        if (q.id === message.event) {
                            this.runPromise(q.handle(message.data));
                        }
                    }
                    const channel = this.channels.get(message.event);
                    if (channel) {
                        channel.handle(message.data);
                    }
                }, () => {
                    for (const q of this.queries.values()) {
                        q.subscribeCode();
                    }
                }));

        return this.closeListener;
    }

}
export type listener = (message: any) => void;



export interface SubscribeToQueryArgs<entityType = any> {
    entityKey: string,
    orderBy?: EntityOrderBy<entityType>
}
export declare type liveQueryMessage = {
    type: "all",
    data: any[]
} | {
    type: "add"
    data: any
} | {
    type: 'replace',
    data: {
        oldId: any,
        item: any
    }
} | {
    type: "remove",
    data: { id: any }
}

export interface SubscribeResult {
    result: [],
    id: string
}


export interface ChannelSubscribe {
    clientId: string,
    channel: string,
    remove: boolean
}


export class AMessageChannel<messageType> {
    userCanSubscribe(channel: string, remult: Remult) {
        if (!remult)
            remult = defaultRemult;
        if (channel == this.key(remult) && remult.isAllowed(this.subscribedAllowed))
            return true;
        return false;
    }
    private key: (remult: Remult) => string;
    constructor(key: (string | ((remult: Remult) => string)), private subscribedAllowed: Allowed) {
        if (typeof key === "string")
            this.key = () => key;
        else this.key = key;

    }
    send(what: messageType, remult?: Remult) {
        if (!this.dispatcher)
            throw new Error("Message couldn't be send since no dispatcher was set");
        this.dispatcher.sendChannelMessage(this.key(remult || defaultRemult), what);
    }
    subscribe(client: LiveQueryClient, onValue: (value: messageType) => void, remult?: Remult) {
        client.subscribeChannel(this.key(remult || defaultRemult), onValue);
    }
    dispatcher: ServerEventDispatcher;
}




/*
[V] use entity normal http route for this - with __action.
[] move id from header to url in stream registration.
[] transaction accumulates messages.
[] on unsubscribe, also unsubscribe on server
[] consolidate channel & query
[] fix stream api url on server
[] remove client id from header
*/