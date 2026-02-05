pipeline {
    agent any

    environment {
        TARGET_USER = "cicd"
        PROD_HOST   = "192.168.150.150"
        STAGING_HOST= "192.168.192.78"
    }

    stages {

        stage('Resolve Target') {
            steps {
                script {
                    if (env.BRANCH_NAME == 'main') {
                        env.TARGET_HOST = env.PROD_HOST
                        env.TARGET_DIR  = "/home/cicd/wa-bot-akr"
                        env.DEPLOY_ENV  = "PRODUCTION"
                    } 
                    else if (env.BRANCH_NAME == 'staging') {
                        env.TARGET_HOST = env.STAGING_HOST
                        env.TARGET_DIR  = "/home/cicd/wa-bot-akr"
                        env.DEPLOY_ENV  = "STAGING"
                    } 
                    else {
                        error "Branch ${env.BRANCH_NAME} is not allowed to deploy"
                    }
                }

                echo "ENV    : ${DEPLOY_ENV}"
                echo "HOST   : ${TARGET_HOST}"
                echo "DIR    : ${TARGET_DIR}"
            }
        }

        stage('Prepare Target') {
            steps {
                sshagent(['ssh-jenkinsprod']) {
                    sh """
                    ssh -o StrictHostKeyChecking=no ${TARGET_USER}@${TARGET_HOST} '
                        mkdir -p ${TARGET_DIR}
                    '
                    """
                }
            }
        }

        stage('Sync Repository') {
    steps {
        sshagent(['ssh-jenkinsprod']) {
            sh """
            rsync -avz \
              --exclude '.git' \
              --exclude '.jenkins' \
              --exclude 'stirling-data' \
              --exclude 'stirling-data/**' \
              ./ \
              ${TARGET_USER}@${TARGET_HOST}:${TARGET_DIR}/
            """
        }
    }
}


        stage('Deploy Docker Compose') {
            steps {
                sshagent(['ssh-jenkinsprod']) {
                    sh """
                    ssh -o StrictHostKeyChecking=no ${TARGET_USER}@${TARGET_HOST} '
                        cd ${TARGET_DIR} &&
                        docker compose down &&
                        docker compose up -d --force-recreate
                    '
                    """
                }
            }
        }
    }

    post {
        success {
            echo "✅ ${DEPLOY_ENV} DEPLOY SUCCESS (${env.BRANCH_NAME})"
        }
        failure {
            echo "❌ ${DEPLOY_ENV} DEPLOY FAILED (${env.BRANCH_NAME})"
        }
    }
}
