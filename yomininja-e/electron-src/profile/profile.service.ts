import { ChangeActiveOcrLanguageUseCase } from "../@core/application/use_cases/change_active_ocr_language/change_active_ocr_language.use_case";
import { ChangeSelectedOcrEngineUseCase } from "../@core/application/use_cases/change_selected_ocr_engine/change_selected_ocr_engine.use_case";
import { GetProfileUseCase } from "../@core/application/use_cases/get_profile/get_profile.use_case";
import { Language } from "../@core/domain/language/language";
import { Profile } from "../@core/domain/profile/profile";

export class ProfileService {
    
    private changeActiveOcrLanguageUseCase: ChangeActiveOcrLanguageUseCase;
    private getProfileUseCase: GetProfileUseCase;
    private changeSelectedOcrEngineUseCase: ChangeSelectedOcrEngineUseCase;

    constructor(
        input: {
            changeActiveOcrLanguageUseCase: ChangeActiveOcrLanguageUseCase;
            getProfileUseCase: GetProfileUseCase;
            changeSelectedOcrEngineUseCase: ChangeSelectedOcrEngineUseCase;
        }
    ){        
        this.changeActiveOcrLanguageUseCase = input.changeActiveOcrLanguageUseCase;
        this.getProfileUseCase = input.getProfileUseCase;
        this.changeSelectedOcrEngineUseCase = input.changeSelectedOcrEngineUseCase;
    }

    async getProfile( input: { profileId: string } ): Promise< Profile | null > {
        return await this.getProfileUseCase.execute({ profileId: input.profileId });
    }

    async getActiveOcrLanguage( input: { profileId: string }): Promise< Language | null > {

        const profile = await this.getProfile({ profileId: input.profileId });
    
        return profile?.active_ocr_language || null;
    }

    changeActiveOcrLanguage( input: { languageCode: string, profileId: string }): void {        
    
        this.changeActiveOcrLanguageUseCase.execute({
            languageCode: input.languageCode,
            profileId: input.profileId,
        });
    }

    async changeSelectedOcrEngine( 
        input: {
            profileId: string;
            ocrEngineAdapterName: string;
        }
    ) {
        await this.changeSelectedOcrEngine({
            profileId: input.profileId,
            ocrEngineAdapterName: input.ocrEngineAdapterName
        })
    }

}