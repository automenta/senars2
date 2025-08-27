import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { logger } from '../lib/logger';

interface Event {
    type: string;
    payload: any;
}

export class EventBus {
    private eventSubject = new Subject<Event>();

    public publish(type: string, payload: any) {
        logger.debug(`Publishing event: ${type}`);
        this.eventSubject.next({ type, payload });
    }

    public subscribe(type: string): Observable<any> {
        return this.eventSubject.asObservable().pipe(
            filter(event => event.type === type),
            map(event => event.payload)
        );
    }

    public get all_events$(): Observable<Event> {
        return this.eventSubject.asObservable();
    }
}
