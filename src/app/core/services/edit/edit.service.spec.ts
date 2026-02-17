import { TestBed } from '@angular/core/testing';
import * as Testing from '@root/test/testbedConfig';
import { cloneDeep } from 'lodash';
import { EditService } from '@core/services/edit/edit.service';
import { ApiService } from '@shared/services/api/api.service';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { ArchiveVO, RecordVO } from '@models/index';
import { AccountService } from '@shared/services/account/account.service';
import { RecordRepo } from '@shared/services/api/record.repo';
import { MessageService } from '@shared/services/message/message.service';
import { DataService } from '@shared/services/data/data.service';
import { ShareLinksApiService } from '@root/app/share-links/services/share-links-api.service';
import { FolderPickerService } from '../folder-picker/folder-picker.service';

const mockDataService = {
	refreshCurrentFolder: async () => await Promise.resolve(),
	downloadFile: async () => await Promise.resolve(),
	hideItemsInCurrentFolder: (items) => {},
	itemUnshared: (item) => {},
};

describe('EditService', () => {
	let service: EditService;
	let apiService: jasmine.SpyObj<ApiService>;
	let accountService: jasmine.SpyObj<AccountService>;
	let shareLinksApiService: jasmine.SpyObj<ShareLinksApiService>;
	beforeEach(() => {
		apiService = jasmine.createSpyObj('ApiService', ['record']);
		apiService.record = {
			update: jasmine.createSpy('update'),
		} as unknown as RecordRepo;

		accountService = jasmine.createSpyObj('AccountService', ['getArchive']);
		accountService.getArchive.and.returnValue(
			new ArchiveVO({ archiveId: 123 }),
		);

		shareLinksApiService = jasmine.createSpyObj('ShareLinksApiService', [
			'generateShareLink',
			'getShareLinksById',
			'updateShareLink',
			'deleteShareLink',
		]);

		const config = cloneDeep(Testing.BASE_TEST_CONFIG);
		config.imports.push(NgbTooltipModule);
		TestBed.configureTestingModule({
			providers: [
				EditService,
				MessageService,
				FolderPickerService,
				{ provide: DataService, useValue: mockDataService },
				{ provide: ApiService, useValue: apiService },
				{ provide: AccountService, useValue: accountService },
				{ provide: ShareLinksApiService, useValue: shareLinksApiService },
			],
		});

		service = TestBed.inject(EditService);
	});

	it('should be created', () => {
		const service = TestBed.inject(EditService);

		expect(service).toBeTruthy();
	});

	it('should call update when there are records', async () => {
		const record = new RecordVO({ recordId: 1, displayName: 'Test' });
		const mockRecords = [record];
		(apiService.record.update as jasmine.Spy).and.returnValue(
			Promise.resolve([{ updatedDT: '2024-03-03' }]),
		);
		await service.updateItems(mockRecords);

		expect(apiService.record.update).toHaveBeenCalledWith(mockRecords, 123);
		expect(record.updatedDT).toBe('2024-03-03');
	});

	it('should handle empty records array and not call update', async () => {
		const mockRecords: RecordVO[] = [];

		await service.updateItems(mockRecords);

		expect(apiService.record.update).not.toHaveBeenCalled();
	});

	it('should NOT update record when recordResponse is empty', async () => {
		const recordMock = new RecordVO({ recordId: 1, folder_linkId: 10 });
		recordMock.update = jasmine.createSpy('update');

		await service.updateItems([recordMock]);

		expect(apiService.record.update).toHaveBeenCalled();
		expect(recordMock.update).not.toHaveBeenCalled();
	});

	it('should call refreshAccountDebounced and refreshCurrentFolder after successful deletion', async () => {
		const record = new RecordVO({ recordId: 1 });
		(apiService as any).record.delete = jasmine
			.createSpy('delete')
			.and.returnValue(Promise.resolve());
		accountService.refreshAccountDebounced = Object.assign(
			jasmine.createSpy('refreshAccountDebounced'),
			{
				cancel: jasmine.createSpy('cancel'),
				flush: jasmine.createSpy('flush'),
			},
		) as any;
		(mockDataService as any).refreshCurrentFolder = jasmine.createSpy(
			'refreshCurrentFolder',
		);

		await service.deleteItems([record]);

		expect(accountService.refreshAccountDebounced).toHaveBeenCalled();
		expect(mockDataService.refreshCurrentFolder).toHaveBeenCalled();
	});

	it('should call refreshAccountDebounced and refreshCurrentFolder even when deletion fails', async () => {
		const record = new RecordVO({ recordId: 1 });
		(apiService as any).record.delete = jasmine
			.createSpy('delete')
			.and.returnValue(Promise.reject(new Error('API error')));
		accountService.refreshAccountDebounced = Object.assign(
			jasmine.createSpy('refreshAccountDebounced'),
			{
				cancel: jasmine.createSpy('cancel'),
				flush: jasmine.createSpy('flush'),
			},
		) as any;
		(mockDataService as any).refreshCurrentFolder = jasmine.createSpy(
			'refreshCurrentFolder',
		);

		try {
			await service.deleteItems([record]);
		} catch (e) {
			// the try will fail, because we are testing the finally block
		}

		expect(accountService.refreshAccountDebounced).toHaveBeenCalled();
		expect(mockDataService.refreshCurrentFolder).toHaveBeenCalled();
	});
});
